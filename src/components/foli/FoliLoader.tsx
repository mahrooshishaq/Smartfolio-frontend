'use client';

import { useEffect, useRef, useState } from 'react';
import Foli, { FoliState } from './Foli';

// Default cute expression loop for waiting states.
const DEFAULT_MOODS: FoliState[] = ['idle', 'look-l', 'look-r', 'happy', 'typing'];
const DEFAULT_MESSAGES = [
  'Warming things up…',
  'Getting you ready…',
  'Tidying your folio…',
  'Almost there…',
];

/**
 * Branded loading screen. Foli cycles through cute expressions and encouraging
 * messages so waits feel alive. Pass a scenario-specific `moods` sequence and
 * `messages` per route (searching → looks around, writing → types, etc.). Use
 * full-screen for route transitions / auth callbacks, or inline inside a card.
 */
export default function FoliLoader({
  title,
  messages = DEFAULT_MESSAGES,
  moods = DEFAULT_MOODS,
  fullScreen = true,
}: {
  title?: string;
  messages?: string[];
  moods?: FoliState[];
  fullScreen?: boolean;
}) {
  const [mood, setMood] = useState<FoliState>(moods[0] ?? 'idle');
  const [msg, setMsg] = useState(0);
  const i = useRef(0);

  useEffect(() => {
    const t = setInterval(() => {
      i.current += 1;
      setMood(moods[i.current % moods.length]);
      setMsg((m) => (m + 1) % messages.length);
    }, 1500);
    return () => clearInterval(t);
  }, [messages.length, moods]);

  const body = (
    <div className="tk-inner">
      <div className="tk-foli">
        {/* The loader drives the mood itself, so the idle personality loop stays off. */}
        <Foli state={mood} interactive={false} />
      </div>
      {title && <h2 className="tk-title">{title}</h2>}
      <p className="tk-sub" aria-live="polite">
        {messages[msg]}
      </p>
      <div className="tk-bar" aria-hidden="true" />
    </div>
  );

  if (!fullScreen) {
    return (
      <div className="flex items-center justify-center py-10" role="status" aria-live="polite">
        {body}
      </div>
    );
  }
  return (
    <div className="tk" role="status" aria-live="polite">
      {body}
    </div>
  );
}
