import { useEffect, useRef, useState } from 'react';
import type { PublicQuestion } from './types';

/**
 * Text-to-speech (browser SpeechSynthesis) + speech-to-text (Web Speech API) for
 * the interview. Kept as a hook so the page orchestrator stays focused on flow.
 *
 * `stopListening` here only stops recognition; persisting the captured transcript
 * into an answer is the caller's concern (it depends on which question is active).
 */
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

  // Phase 3.4 — try a natural neural voice first, fall back to browser TTS on any failure.
  const speak = async (text: string, autoListen = true) => {
    const fetcher = neuralRef.current;
    if (fetcher && !neuralDisabledRef.current) {
      const blob = await fetcher(text).catch(() => null);
      if (blob && blob.size > 0) {
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => {
          setIsSpeaking(false);
          URL.revokeObjectURL(url);
          if (autoListen) startListening();
        };
        window.speechSynthesis?.cancel();
        setIsSpeaking(true);
        try {
          await audio.play();
          return; // playing — onended handles the rest
        } catch {
          setIsSpeaking(false);
          URL.revokeObjectURL(url);
          audioRef.current = null;
        }
      } else {
        neuralDisabledRef.current = true; // TTS unavailable this session; stop retrying
      }
    }
    browserSpeak(text, autoListen);
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
    window.speechSynthesis?.cancel();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
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
