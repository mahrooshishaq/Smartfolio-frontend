import { useEffect, useRef, useState } from 'react';
import type { PublicQuestion } from './types';

/**
 * Text-to-speech (neural Kokoro via the backend, with browser SpeechSynthesis
 * as the always-available fallback) + speech-to-text for the interview. Kept
 * as a hook so the page orchestrator stays focused on flow.
 *
 * Neural playback is sentence-pipelined: text is split into sentence chunks, a
 * short first chunk is fetched and played immediately while the next chunk
 * downloads in parallel, so time-to-first-audio is one short synthesis instead
 * of the whole utterance. Fetched chunks are LRU-cached client-side, so
 * replaying a question never re-hits the server.
 *
 * STT is two-layered: the Web Speech API provides live interim captions while
 * the candidate talks, but the answer of record comes from recording the mic
 * with MediaRecorder and transcribing it server-side (Whisper via Groq) when
 * listening ends — far more accurate for accented English, and it never loses
 * words to the browser recognizer's silence timeouts. If the recorder or the
 * transcription endpoint is unavailable, the browser transcript stands.
 *
 * `finalizeListening` stops capture and resolves with the best transcript;
 * persisting it into an answer is the caller's concern (it depends on which
 * question is active).
 */

// Sentence chunking: a short first chunk for fast first audio, then chunks
// kept small enough that each one's spoken duration exceeds the synthesis
// time of the next (on the free-tier CPU a chunk synthesizes at ~0.75-1x
// realtime plus ~1.3s network) — larger chunks open audible gaps between
// sentences. Single sentences longer than the limit are sent whole.
const FIRST_CHUNK_MAX = 120;
const CHUNK_MAX = 160;
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

// The exact text speakMcq() reads aloud — exported so callers can prefetch it
// with matching cache keys.
export function mcqSpeechText(q: PublicQuestion): string {
  const optionsText = (q.options || [])
    .map((o, i) => `Option ${String.fromCharCode(65 + i)}: ${o}`)
    .join('. ');
  return `${q.question}. ${optionsText}`;
}

// Pick the best container the browser can record; Groq Whisper accepts all of these.
const pickRecorderMime = (): string => {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? '';
};

// Below this size the recording is a fraction of a second of silence — not
// worth a transcription round-trip (Opus is ~1.5KB/s of speech).
const MIN_TRANSCRIBE_BYTES = 1000;

// Live-caption engine: MoonshineJS runs a small on-device STT model in the
// browser for the captions shown WHILE the candidate speaks — better with
// accents than the browser recognizer, and it works in browsers without Web
// Speech (Firefox). On by default; set NEXT_PUBLIC_LIVE_CAPTIONS=browser to
// opt out. The browser recognizer stays as the permanent fallback, and the
// Whisper answer of record is unaffected either way.
// NOTE: the package's MoonshineSpeechRecognition polyfill is broken in v0.1.29
// (it enables VAD mode but only listens for streaming-mode updates, so onresult
// never fires) — we drive MicrophoneTranscriber directly in streaming mode.
const MOONSHINE_ENABLED = process.env.NEXT_PUBLIC_LIVE_CAPTIONS !== 'browser';
const MOONSHINE_MODEL = 'model/tiny'; // fetched once from download.moonshine.ai, then browser-cached
const MOONSHINE_LOAD_TIMEOUT_MS = 30_000;
type MoonshineTranscriber = import('@moonshine-ai/moonshine-js').MicrophoneTranscriber;

export function useSpeech(
  neuralTts?: (text: string) => Promise<Blob | null>,
  transcribeAudio?: (audio: Blob) => Promise<string | null>,
) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [supported, setSupported] = useState(true); // STT support
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef('');
  // Whisper STT: mic recording that gets transcribed server-side on stop.
  const transcribeRef = useRef(transcribeAudio);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const listenSeqRef = useRef(0); // bumping this discards stale transcription results
  const wantListeningRef = useRef(false); // true between start and finalize — drives recognition auto-restart
  const finalizePromiseRef = useRef<Promise<string> | null>(null);
  // Moonshine live captions (feature-flagged). 'failed' is terminal: any load
  // or runtime error permanently falls back to the browser recognizer.
  const moonshineRef = useRef<MoonshineTranscriber | null>(null);
  const moonshineStateRef = useRef<'idle' | 'loading' | 'ready' | 'failed'>(
    MOONSHINE_ENABLED ? 'idle' : 'failed',
  );
  const moonshineActiveRef = useRef(false); // a moonshine capture is running right now
  const moonshineCommittedRef = useRef(''); // segments committed during the current listen
  // Neural TTS (Phase 3.4): a fetcher returning audio, or null to use browser TTS.
  const neuralRef = useRef(neuralTts);
  const neuralDisabledRef = useRef(false); // stop retrying once TTS proves unavailable
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const speakSeqRef = useRef(0); // bumping this cancels any in-flight speak chain
  const blobCacheRef = useRef<Map<string, Blob>>(new Map()); // chunk text → audio
  const pendingChunkRef = useRef<Map<string, Promise<Blob | null>>>(new Map()); // in-flight fetch dedup
  useEffect(() => { neuralRef.current = neuralTts; }, [neuralTts]);
  useEffect(() => { transcribeRef.current = transcribeAudio; }, [transcribeAudio]);

  useEffect(() => {
    const cleanup = () => {
      wantListeningRef.current = false;
      moonshineActiveRef.current = false;
      try { moonshineRef.current?.stop(); } catch { /* ignore */ }
      try { recognitionRef.current?.stop(); } catch { /* ignore */ }
      try { mediaRecorderRef.current?.stop(); } catch { /* ignore */ }
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
    const canRecord =
      typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      // No live captions from the browser (Moonshine may still provide them),
      // and voice answers still work via recorder + Whisper.
      setSupported(canRecord);
      return cleanup;
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
    rec.onend = () => {
      // The browser recognizer gives up after a pause; while the answer is
      // still being recorded, restart it so live captions keep flowing (the
      // recorder itself never stopped, so no words are lost either way).
      if (wantListeningRef.current) {
        // If the restart fails, the recorder is still capturing — only the
        // live captions stop, so stay in the listening state.
        try { rec.start(); } catch { /* ignore */ }
        return;
      }
      setIsListening(false);
    };
    rec.onerror = (event: any) => {
      // 'no-speech' (silence timeout) and 'aborted' (we stopped it) are normal
      // lifecycle events, not failures — don't spam the console with errors.
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        console.warn('Speech recognition error', event.error);
      }
      // onend fires right after and decides whether to restart or stop.
    };
    recognitionRef.current = rec;
    return cleanup;
  }, []);

  const getBestVoice = () => {
    if (!window.speechSynthesis) return null;
    const voices = window.speechSynthesis.getVoices();
    // The interviewer persona is male — prefer male en voices in the browser
    // fallback so it matches the neural (Kokoro am_michael) voice.
    const preferred = [
      'Microsoft Guy Online',
      'Microsoft Christopher Online',
      'Microsoft Eric Online',
      'Google UK English Male',
      'Microsoft David',
      'Daniel',
      'Alex',
    ];
    for (const name of preferred) {
      const v = voices.find((v) => v.name.includes(name));
      if (v) return v;
    }
    const male = voices.find((v) => v.lang.startsWith('en') && /male|man\b/i.test(v.name));
    if (male) return male;
    return voices.find((v) => v.lang.startsWith('en')) || voices[0];
  };

  const cleanTextForSpeech = (text: string) =>
    text
      .replace(/_+/g, ' ')
      .replace(/[:;]/g, '.')
      .replace(/[()]/g, ',')
      .replace(/[*#]/g, '')
      .trim();

  // Start recording the mic for Whisper transcription. Best-effort: if the
  // recorder can't start (permission denied, unsupported), the Web Speech
  // transcript remains the answer source, exactly as before.
  const startRecorder = async (seq: number) => {
    if (!transcribeRef.current) return;
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) return;
    try {
      // Processed mono capture: echo cancellation keeps the interviewer's TTS
      // voice (playing through the speakers) out of the recording, noise
      // suppression/AGC clean up fan noise and quiet voices — all of which
      // directly improves what Whisper hears.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
      if (seq !== listenSeqRef.current) {
        // Listening was cancelled/restarted while the permission prompt was open.
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const mime = pickRecorderMime();
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      audioChunksRef.current = [];
      rec.ondataavailable = (e: BlobEvent) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      rec.start(1000); // timeslice so long answers accumulate incrementally
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = rec;
    } catch {
      /* mic unavailable — recognition-only mode */
    }
  };

  // Stop the recorder and hand back everything it captured (null if nothing).
  const stopRecorder = (): Promise<Blob | null> =>
    new Promise((resolve) => {
      const rec = mediaRecorderRef.current;
      const stream = mediaStreamRef.current;
      mediaRecorderRef.current = null;
      mediaStreamRef.current = null;
      const finish = () => {
        stream?.getTracks().forEach((t) => t.stop());
        const chunks = audioChunksRef.current;
        audioChunksRef.current = [];
        if (!chunks.length) { resolve(null); return; }
        resolve(new Blob(chunks, { type: rec?.mimeType || 'audio/webm' }));
      };
      if (!rec || rec.state === 'inactive') { finish(); return; }
      rec.onstop = finish;
      try { rec.stop(); } catch { finish(); }
    });

  // Preload the Moonshine caption engine — downloads the model + VAD without
  // touching the mic, so the first listen starts instantly. Called during the
  // call-connect ceremony; idempotent, and any failure is a silent permanent
  // fallback to the browser recognizer.
  const preloadLiveCaptions = () => {
    if (moonshineStateRef.current !== 'idle') return;
    moonshineStateRef.current = 'loading';
    (async () => {
      // The npm package's ESM bundle can't go through webpack (it embeds
      // file://-guarded `new URL()` refs to onnx assets that don't exist in
      // the package), so the prebuilt bundle is self-hosted in /public/vendor
      // and loaded natively at runtime — same-origin, which also keeps its
      // internal module Worker legal. Copied from
      // @moonshine-ai/moonshine-js@0.1.29 dist/; re-copy when bumping the dep.
      const bundleUrl = '/vendor/moonshine.min.js';
      const { MicrophoneTranscriber } = (await import(
        /* webpackIgnore: true */ bundleUrl
      )) as typeof import('@moonshine-ai/moonshine-js');
      // The full caption = segments committed at pauses + the live speculative
      // tail of the current segment (the engine flushes its buffer per commit,
      // so accumulation across pauses is on us).
      const showCaption = (tail: string) => {
        if (!moonshineActiveRef.current) return;
        const full = [moonshineCommittedRef.current, tail.trim()].filter(Boolean).join(' ');
        if (full) {
          setTranscript(full);
          transcriptRef.current = full;
        }
      };
      const transcriber = new MicrophoneTranscriber(
        MOONSHINE_MODEL,
        {
          onTranscriptionUpdated: (text) => showCaption(text ?? ''),
          onTranscriptionCommitted: (text) => {
            if (!moonshineActiveRef.current) return;
            const t = (text ?? '').trim();
            if (t) {
              moonshineCommittedRef.current =
                [moonshineCommittedRef.current, t].filter(Boolean).join(' ');
            }
            showCaption('');
          },
          onError: () => {
            moonshineStateRef.current = 'failed';
            moonshineActiveRef.current = false;
          },
        },
        false, // streaming mode — VAD mode never emits live updates
      );
      await Promise.race([
        transcriber.load(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('moonshine load timeout')), MOONSHINE_LOAD_TIMEOUT_MS)),
      ]);
      moonshineRef.current = transcriber;
      // onError during load may already have marked us failed — don't undo it.
      if (moonshineStateRef.current === 'loading') moonshineStateRef.current = 'ready';
    })().catch(() => {
      moonshineStateRef.current = 'failed';
    });
  };

  const startListening = () => {
    const canRecord =
      !!transcribeRef.current &&
      typeof MediaRecorder !== 'undefined' &&
      !!navigator.mediaDevices?.getUserMedia;
    const moonshineReady = moonshineStateRef.current === 'ready' && !!moonshineRef.current;
    if (!recognitionRef.current && !moonshineReady && !canRecord) return;
    const seq = ++listenSeqRef.current;
    finalizePromiseRef.current = null;
    wantListeningRef.current = true;
    setIsTranscribing(false);
    setTranscript('');
    transcriptRef.current = '';
    // Caption engine: Moonshine when loaded, else the browser recognizer.
    // (If Moonshine is still downloading, this listen just uses the browser.)
    if (moonshineReady) {
      moonshineCommittedRef.current = '';
      moonshineActiveRef.current = true;
      moonshineRef.current!.start().catch(() => {
        // Engine died on startup — permanent fallback, and rescue THIS listen.
        moonshineStateRef.current = 'failed';
        moonshineActiveRef.current = false;
        if (seq === listenSeqRef.current && wantListeningRef.current && recognitionRef.current) {
          try { recognitionRef.current.start(); } catch { /* ignore */ }
        }
      });
    } else if (recognitionRef.current) {
      try { recognitionRef.current.start(); } catch { /* already started */ }
    }
    void startRecorder(seq);
    setIsListening(true);
  };

  /**
   * Stop capture and resolve with the answer of record: the Whisper transcript
   * of the recorded audio when available, else whatever the browser recognizer
   * heard. Idempotent — repeat calls (e.g. stop button then Next) return the
   * same in-flight promise. `isTranscribing` is true while the server call runs.
   */
  const finalizeListening = (): Promise<string> => {
    if (finalizePromiseRef.current) return finalizePromiseRef.current;
    const seq = listenSeqRef.current;
    wantListeningRef.current = false;
    if (moonshineActiveRef.current) {
      moonshineActiveRef.current = false;
      try { moonshineRef.current?.stop(); } catch { /* ignore */ }
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
    }
    setIsListening(false);
    const promise = (async () => {
      const blob = await stopRecorder();
      const browserHeard = transcriptRef.current;
      const transcriber = transcribeRef.current;
      if (!blob || blob.size < MIN_TRANSCRIBE_BYTES || !transcriber) return browserHeard;
      setIsTranscribing(true);
      try {
        const text = (await transcriber(blob))?.trim();
        if (text && seq === listenSeqRef.current) {
          setTranscript(text);
          transcriptRef.current = text;
          return text;
        }
      } catch { /* fall back to the browser transcript */ }
      finally {
        setIsTranscribing(false);
      }
      return seq === listenSeqRef.current ? browserHeard : transcriptRef.current;
    })();
    finalizePromiseRef.current = promise;
    return promise;
  };

  // Fire-and-forget stop, for callers that don't need the final text (e.g.
  // speak() enforcing that speaking and listening never overlap).
  const stopListening = () => { void finalizeListening(); };

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
    utterance.onerror = () => {
      // Never leave the UI stuck in "speaking" if the utterance dies.
      setIsSpeaking(false);
      if (autoListen) startListening();
    };
    window.speechSynthesis.speak(utterance);
  };

  // Fetch one chunk's audio, going through the LRU cache first. Concurrent
  // requests for the same chunk (a prefetch racing speak()) share one fetch,
  // so the server never synthesizes the same audio twice.
  const getChunkBlob = (chunk: string): Promise<Blob | null> => {
    const fetcher = neuralRef.current;
    const hit = blobCacheRef.current.get(chunk);
    if (hit) {
      blobCacheRef.current.delete(chunk);
      blobCacheRef.current.set(chunk, hit); // LRU refresh
      return Promise.resolve(hit);
    }
    const inFlight = pendingChunkRef.current.get(chunk);
    if (inFlight) return inFlight;
    if (!fetcher) return Promise.resolve(null);
    const request = fetcher(chunk)
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
      .catch(() => null)
      .finally(() => pendingChunkRef.current.delete(chunk));
    pendingChunkRef.current.set(chunk, request);
    return request;
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
    stopListening(); // speaking and listening are mutually exclusive turns
    const handled = await speakNeural(text, autoListen, seq);
    if (!handled && seq === speakSeqRef.current) browserSpeak(text, autoListen);
  };

  // Reads an MCQ's question plus its lettered options aloud (no auto-listen).
  const speakMcq = (q: PublicQuestion) => {
    speak(mcqSpeechText(q), false);
  };

  // Warm the audio cache for text that will be spoken soon (e.g. the next
  // question, fetched while the candidate answers the current one). Sequential
  // and fire-and-forget; chunks land in the same cache speak() reads, so the
  // next question starts instantly instead of waiting on synthesis.
  const prefetchSpeech = (text: string) => {
    if (!neuralRef.current || neuralDisabledRef.current) return;
    const chunks = splitForTts(text);
    (async () => {
      for (const c of chunks) {
        if (neuralDisabledRef.current) return;
        await getChunkBlob(c);
      }
    })().catch(() => { /* prefetch is best-effort */ });
  };

  const resetTranscript = () => {
    listenSeqRef.current++; // any in-flight transcription now belongs to a past question — discard it
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
    isTranscribing,
    transcript,
    transcriptRef,
    supported,
    speak,
    speakMcq,
    prefetchSpeech,
    preloadLiveCaptions,
    startListening,
    stopListening,
    finalizeListening,
    resetTranscript,
    cancel,
  };
}
