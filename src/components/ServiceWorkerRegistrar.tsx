'use client';

import { useEffect, useRef, useState } from 'react';

export default function ServiceWorkerRegistrar() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const reloading = useRef(false);

  useEffect(() => {
    // Registering in dev fights with HMR — test the PWA against `npm run build && npm start`.
    if (process.env.NODE_ENV !== 'production') return;
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    let registration: ServiceWorkerRegistration | undefined;

    const onControllerChange = () => {
      if (reloading.current) return;
      reloading.current = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        registration = reg;

        // A build was already downloaded and is sitting waiting from a previous visit.
        if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting);

        reg.addEventListener('updatefound', () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            // With no existing controller this is the first-ever install, not an update.
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              setWaiting(installing);
            }
          });
        });
      })
      .catch(() => {
        /* An unavailable service worker must never break the app. */
      });

    // Browsers only check for a new worker on their own schedule; nudge it whenever
    // the user comes back to the app.
    const checkForUpdate = () => {
      if (document.visibilityState === 'visible') registration?.update().catch(() => {});
    };
    document.addEventListener('visibilitychange', checkForUpdate);

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      document.removeEventListener('visibilitychange', checkForUpdate);
    };
  }, []);

  if (!waiting) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-4 z-[100] mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-white/95 p-4 shadow-lg ring-1 ring-black/5 backdrop-blur"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5.5rem)' }}
    >
      <p className="flex-1 text-sm text-gray-700">A new version of SmartFolio is available.</p>
      <button
        type="button"
        onClick={() => waiting.postMessage({ type: 'SKIP_WAITING' })}
        className="shrink-0 rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
      >
        Refresh
      </button>
    </div>
  );
}
