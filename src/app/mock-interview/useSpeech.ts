import { useEffect, useRef, useState } from 'react';
import type { PublicQuestion } from './types';

/**
 * Text-to-speech (browser SpeechSynthesis) + speech-to-text (Web Speech API) for
 * the interview. Kept as a hook so the page orchestrator stays focused on flow.
 *
 * `stopListening` here only stops recognition; persisting the captured transcript
 * into an answer is the caller's concern (it depends on which question is active).
 */
export function useSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [supported, setSupported] = useState(true); // STT support
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef('');

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

  // Phase 3.4 seam — neural TTS integration point.
  // To use a natural voice, fetch audio from a backend TTS proxy here and play it
  // via an <audio> element, keeping this browser-TTS path as the automatic fallback.
  const speak = (text: string, autoListen = true) => {
    if (!window.speechSynthesis) return;
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

  const cancel = () => window.speechSynthesis?.cancel();

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
