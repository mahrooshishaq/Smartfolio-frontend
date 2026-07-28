'use client';

import { useEffect, useState } from 'react';
import Foli from './Foli';

export default function AuthTransition({
  show,
  title,
  subtitle,
  durationMs = 1500,
  onDone,
}: {
  show: boolean;
  title: string;
  subtitle: string;
  durationMs?: number;
  onDone?: () => void;
}) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!show) return;
    setLeaving(false);
    const fade = window.setTimeout(() => setLeaving(true), durationMs);
    const done = window.setTimeout(() => onDone?.(), durationMs + 320);
    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(done);
    };
    // onDone intentionally excluded so a fresh closure does not restart timers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, durationMs]);

  if (!show) return null;

  return (
    <div className={`tk ${leaving ? 'tk--leaving' : ''}`} role="status" aria-live="polite">
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
