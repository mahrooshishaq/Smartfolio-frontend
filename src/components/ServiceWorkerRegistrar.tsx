'use client';

import { useEffect, useRef } from 'react';

/**
 * Registers the service worker and auto-applies updates: as soon as a new build
 * has installed and is waiting, we tell it to activate (SKIP_WAITING). That fires
 * `controllerchange`, and we reload once — silently. No "new version available"
 * prompt; the user just always gets the latest build.
 */
export default function ServiceWorkerRegistrar() {
  const reloading = useRef(false);

  useEffect(() => {
    // Never register a worker during development; clear production-preview workers instead.
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    // A worker installed by a production preview can keep controlling localhost
    // and serve stale Next chunks. Development must always use the live server.
    if (process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker.getRegistrations()
        .then((registrations) =>
          Promise.all(registrations.map((registration) => registration.unregister())),
        )
        .catch(() => {});

      if ('caches' in window) {
        window.caches.keys()
          .then((keys) =>
            Promise.all(
              keys
                .filter((key) => key.startsWith('sf-static-'))
                .map((key) => window.caches.delete(key)),
            ),
          )
          .catch(() => {});
      }
      return;
    }

    let registration: ServiceWorkerRegistration | undefined;

    const onControllerChange = () => {
      if (reloading.current) return;
      reloading.current = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    // Ask a waiting worker to take over immediately. Only when a controller already
    // exists — otherwise this is the first-ever install, not an update, and there is
    // nothing to refresh onto.
    const activate = (worker: ServiceWorker | null) => {
      if (worker && navigator.serviceWorker.controller) worker.postMessage({ type: 'SKIP_WAITING' });
    };

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        registration = reg;

        // A build was already downloaded and is sitting waiting from a previous visit.
        if (reg.waiting) activate(reg.waiting);

        reg.addEventListener('updatefound', () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed') activate(installing);
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

  return null;
}
