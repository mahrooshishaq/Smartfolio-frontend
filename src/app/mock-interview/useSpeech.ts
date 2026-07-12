import { useEffect, useRef, useState } from 'react';
import type { PublicQuestion } from './types';

/**
 * Text-to-speech (neural Kokoro via the backend, with browser SpeechSynthesis
 * as the always-available fallback) + speech-to-text (Web Speech API) for the
 * interview. Kept as a hook so the page orchestrator stays focused on flow.
 *
 * Neural playback is sentence-pipelined: text is split into sentence chunks, a
 * short first chunk is fetched and played immediately while the next chunk
 * downloads in parallel, so time-to-first-audio is one short synthesis instead
 * of the whole utterance. Fetched chunks are LRU-cached client-side, so
 * replaying a question never re-hits the server.
 *
 * `stopListening` here only stops recognition; persisting the captured transcript
 * into an answer is the caller's concern (it depends on which question is active).
 */

// Sentence chunking: a short first chunk for fast first audio, then larger
// merged chunks to keep the request count low. Single sentences longer than
// the limit are sent whole — the server handles long text fine.
const FIRST_CHUNK_MAX = 120;
const CHUNK_MAX = 260;
export function splitForTts(text: string): string[] {
  const sentences = text.match(/[^.?!]+[.?!]+["')\]]*\s*|[^.?!]+$/g) ?? [text];
  const chunks: string[] = [];
  let current = '';
  for (const raw of sentences) {
    const s = raw.trim();
    if (!s) continue;
    const limit = chunks.length === 0 ? FIRST_CHUNK_MAX : CHUNK_MAX;
    if (current && current.length + s.length + 1 > limit) {
      chunks.push(current);
      current = s;
    } else {
      current = current ? `${current} ${s}` : s;
    }
  }
  if (current) chunks.push(current);
  return chunks.length ? chunks : [text];
}

const BLOB_CACHE_MAX = 48;

export function useSpeech(neuralTts?: (text: string) => Promise<Blob | null>) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [supported, setSupported] = useState(true); // STT support
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef('');
  // Neural TTS (Phase 3.4): a fetcher returning audio, or null to use browser TTS.
  const neuralRef = useRef(neuralTts);
  const neuralDisabledRef = useRef(false); // stop retrying once TTS proves unavailable
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const speakSeqRef = useRef(0); // bumping this cancels any in-flight speak chain
  const blobCacheRef = useRef<Map<string, Blob>>(new Map()); // chunk text → audio
  useEffect(() => { neuralRef.current = neuralTts; }, [neuralTts]);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSupported(false);
      return;
    }
    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    rec.onresult = (event: any) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) final += event.results[i][0].transcript;
        else interim += event.results[i][0].transcript;
      }
      const current = final || interim;
      setTranscript(current);
      transcriptRef.current = current;
    };
    rec.onend = () => setIsListening(false);
    rec.onerror = (event: any) => {
      console.error('Speech recognition error', event.error);
      setIsListening(false);
    };
    recognitionRef.current = rec;
    return () => {
      try { rec.stop(); } catch { /* ignore */ }
    };
  }, []);

  const getBestVoice = () => {
    if (!window.speechSynthesis) return null;
    const voices = window.speechSynthesis.getVoices();
    const preferred = [
      'Google US English',
      'Microsoft Aria Online',
      'Microsoft Jenny Online',
      'English (United States)',
      'en-US',
    ];
    for (const name of preferred) {
      const v = voices.find((v) => v.name.includes(name));
      if (v) return v;
    }
    return voices.find((v) => v.lang.startsWith('en')) || voices[0];
  };

  const cleanTextForSpeech = (text: string) =>
    text
      .replace(/_+/g, ' ')
      .replace(/[:;]/g, '.')
      .replace(/[()]/g, ',')
      .replace(/[*#]/g, '')
      .trim();

  const startListening = () => {
    if (!recognitionRef.current) return;
    setTranscript('');
    transcriptRef.current = '';
    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch {
      console.warn('Recognition already started');
    }
  };

  const stopListening = () => {
    if (!recognitionRef.current) return;
    recognitionRef.current.stop();
    setIsListening(false);
  };

  // Browser SpeechSynthesis — the always-available fallback.
  const browserSpeak = (text: string, autoListen: boolean) => {
    if (!window.speechSynthesis) {
      if (autoListen) startListening();
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(cleanTextForSpeech(text));
    const voice = getBestVoice();
    if (voice) utterance.voice = voice;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      if (autoListen) startListening();
    };
    window.speechSynthesis.speak(utterance);
  };

  // Fetch one chunk's audio, going through the LRU cache first.
  const getChunkBlob = (chunk: string): Promise<Blob | null> => {
    const fetcher = neuralRef.current;
    const hit = blobCacheRef.current.get(chunk);
    if (hit) {
      blobCacheRef.current.delete(chunk);
      blobCacheRef.current.set(chunk, hit); // LRU refresh
      return Promise.resolve(hit);
    }
    if (!fetcher) return Promise.resolve(null);
    return fetcher(chunk)
      .then((b) => {
        if (!b || b.size === 0) return null;
        blobCacheRef.current.set(chunk, b);
        while (blobCacheRef.current.size > BLOB_CACHE_MAX) {
          const oldest = blobCacheRef.current.keys().next().value;
          if (oldest === undefined) break;
          blobCacheRef.current.delete(oldest);
        }
        return b;
      })
      .catch(() => null);
  };

  // Resolves when playback finishes OR is paused by cancel(); rejects only if
  // play() itself fails (e.g. autoplay policy) so the caller can fall back.
  const playBlob = (blob: Blob) =>
    new Promise<void>((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      const done = () => {
        URL.revokeObjectURL(url);
        resolve();
      };
      audio.onended = done;
      audio.onpause = () => {
        if (!audio.ended) done(); // cancel() paused us — unwind the chain
      };
      audio.play().catch((e) => {
        URL.revokeObjectURL(url);
        reject(e);
      });
    });

  const stopAudio = () => {
    if (audioRef.current) {
      try { audioRef.current.pause(); } catch { /* ignore */ }
      audioRef.current = null;
    }
  };

  // The pipelined neural path. Returns false only when neural TTS can't start
  // at all (caller then speaks the whole text with the browser voice).
  const speakNeural = async (text: string, autoListen: boolean, seq: number): Promise<boolean> => {
    if (!neuralRef.current || neuralDisabledRef.current) return false;
    const chunks = splitForTts(text);
    let pending = getChunkBlob(chunks[0]);
    for (let i = 0; i < chunks.length; i++) {
      const blob = await pending;
      if (seq !== speakSeqRef.current) return true; // superseded or cancelled
      if (!blob) {
        if (i === 0) {
          neuralDisabledRef.current = true; // TTS unavailable this session; stop retrying
          return false;
        }
        browserSpeak(chunks.slice(i).join(' '), autoListen); // finish in the fallback voice
        return true;
      }
      if (i + 1 < chunks.length) pending = getChunkBlob(chunks[i + 1]); // prefetch during playback
      if (i === 0) {
        window.speechSynthesis?.cancel();
        setIsSpeaking(true);
      }
      try {
        await playBlob(blob);
      } catch {
        setIsSpeaking(false);
        if (seq === speakSeqRef.current) browserSpeak(chunks.slice(i).join(' '), autoListen);
        return true;
      }
      if (seq !== speakSeqRef.current) return true;
    }
    setIsSpeaking(false);
    audioRef.current = null;
    if (autoListen) startListening();
    return true;
  };

  // Try the natural neural voice first, fall back to browser TTS on any failure.
  const speak = async (text: string, autoListen = true) => {
    const seq = ++speakSeqRef.current;
    stopAudio(); // never overlap with a previous utterance
    const handled = await speakNeural(text, autoListen, seq);
    if (!handled && seq === speakSeqRef.current) browserSpeak(text, autoListen);
  };

  // Reads an MCQ's question plus its lettered options aloud (no auto-listen).
  const speakMcq = (q: PublicQuestion) => {
    const optionsText = (q.options || [])
      .map((o, i) => `Option ${String.fromCharCode(65 + i)}: ${o}`)
      .join('. ');
    speak(`${q.question}. ${optionsText}`, false);
  };

  const resetTranscript = () => {
    setTranscript('');
    transcriptRef.current = '';
  };

  const cancel = () => {
    speakSeqRef.current++; // invalidate any in-flight speak chain
    window.speechSynthesis?.cancel();
    stopAudio();
    setIsSpeaking(false);
  };

  return {
    isSpeaking,
    isListening,
    transcript,
    transcriptRef,
    supported,
    speak,
    speakMcq,
    startListening,
    stopListening,
    resetTranscript,
    cancel,
  };
}
