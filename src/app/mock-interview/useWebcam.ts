import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Local webcam self-view for the video-call interview (Phase 3.1).
 * The stream stays entirely client-side — it is never uploaded or recorded.
 *
 * `videoRef` is a callback ref so the stream binds correctly regardless of order:
 * the camera can start (during the "connecting" ceremony) before the <video>
 * element mounts (in the call stage), and it will still attach on mount.
 */
export function useWebcam() {
  const elRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useCallback((el: HTMLVideoElement | null) => {
    elRef.current = el;
    if (el && streamRef.current) el.srcObject = streamRef.current;
  }, []);

  const start = async () => {
    if (streamRef.current) return; // already running
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera not supported');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = stream;
      if (elRef.current) elRef.current.srcObject = stream;
      setCameraOn(true);
      setCameraError(null);
    } catch {
      setCameraError('Camera off');
      setCameraOn(false);
    }
  };

  const stop = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (elRef.current) elRef.current.srcObject = null;
    setCameraOn(false);
  };

  const toggle = () => (cameraOn ? stop() : start());

  // Always release the camera on unmount.
  useEffect(() => () => stop(), []);

  return { videoRef, cameraOn, cameraError, start, stop, toggle };
}
