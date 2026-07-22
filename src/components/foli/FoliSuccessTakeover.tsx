'use client';

import { useEffect, useRef, useState } from 'react';
import Foli from './Foli';
import { burstConfetti } from './confetti';

/**
 * Full-screen celebration shown after a successful login (email or Google) before
 * the app redirects. Foli fills the screen with a happy expression + confetti,
 * holds for `durationMs`, then fades and calls `onDone` (do the redirect there).
 */
export default function FoliSuccessTakeover({
  show,
  title = "You're in! 🎉",
  subtitle = 'Taking you to your dashboard…',
  durationMs = 2600,
  onDone,
}: {
  show: boolean;
  title?: string;
  subtitle?: string;
  durationMs?: number;
  onDone?: () => void;
}) {
  const confettiRef = useRef<HTMLDivElement>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!show) return;
    burstConfetti(confettiRef.current);
    const fade = setTimeout(() => setLeaving(true), durationMs);
    const done = setTimeout(() => onDone?.(), durationMs + 500);
    return () => {
      clearTimeout(fade);
      clearTimeout(done);
    };
    // onDone intentionally excluded — a new closure each render must not re-arm timers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, durationMs]);

  if (!show) return null;

  return (
    <div className={`tk ${leaving ? 'tk--leaving' : ''}`} role="status" aria-live="polite">
      <div className="foli-confetti" ref={confettiRef} />
      <div className="tk-inner">
        <div className="tk-foli">
          <Foli state="success" interactive={false} />
        </div>
        <h2 className="tk-title">{title}</h2>
        <p className="tk-sub">{subtitle}</p>
        <div className="tk-bar" aria-hidden="true" />
      </div>
    </div>
  );
}
