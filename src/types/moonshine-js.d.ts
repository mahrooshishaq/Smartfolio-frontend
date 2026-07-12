// Minimal typings for @moonshine-ai/moonshine-js (v0.1.x ships no .d.ts).
// Only the surface used by useSpeech.ts is declared, mirrored from the
// package's TypeScript sources (src/transcriber.ts, src/microphoneTranscriber.ts).
declare module '@moonshine-ai/moonshine-js' {
  export interface TranscriberCallbacks {
    onPermissionsRequested: () => unknown;
    onError: (error: unknown) => unknown;
    onModelLoadStarted: () => unknown;
    onModelLoaded: () => unknown;
    onTranscribeStarted: () => unknown;
    onTranscribeStopped: () => unknown;
    /** Streaming mode (useVAD=false) only: speculative text of the current segment. */
    onTranscriptionUpdated: (text: string) => unknown;
    /** Segment finalized after a pause; the internal buffer flushes afterwards. */
    onTranscriptionCommitted: (text: string, buffer?: AudioBuffer) => unknown;
    onSpeechStart: () => unknown;
    onSpeechEnd: () => unknown;
  }

  export class MicrophoneTranscriber {
    constructor(
      modelURL: string,
      callbacks?: Partial<TranscriberCallbacks>,
      useVAD?: boolean,
      precision?: string,
    );
    /** Downloads/initializes the STT + VAD models without opening the mic. */
    load(): Promise<void>;
    /** Requests the mic and begins transcription (loads models if needed). */
    start(): Promise<void>;
    stop(): void;
    isActive: boolean;
  }
}
