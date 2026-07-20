'use client';

import { useEffect, useState } from 'react';

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

declare global {
  interface Window {
    __pwaPrompt?: InstallEvent | null;
  }
}

const DISMISSED_KEY = 'pwaInstallDismissed';

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari predates display-mode.
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export default function InstallPrompt() {
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (localStorage.getItem(DISMISSED_KEY)) return;

    // The event usually fires before React hydrates, so layout.tsx stashes it.
    if (window.__pwaPrompt) setPrompt(window.__pwaPrompt);

    const onInstallable = () => setPrompt(window.__pwaPrompt ?? null);
    const onInstalled = () => {
      setPrompt(null);
      setIosHint(false);
      window.__pwaPrompt = null;
    };
    window.addEventListener('pwa-installable', onInstallable);
    window.addEventListener('appinstalled', onInstalled);

    // iOS never fires beforeinstallprompt — installing there is a manual Share-sheet
    // action, so the best we can do is tell the user where it is.
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS/.test(ua)) {
      setIosHint(true);
    }

    return () => {
      window.removeEventListener('pwa-installable', onInstallable);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, '1');
    setPrompt(null);
    setIosHint(false);
  };

  const install = async () => {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    // A dismissed prompt cannot be reused; drop it either way.
    window.__pwaPrompt = null;
    setPrompt(null);
    if (outcome === 'dismissed') localStorage.setItem(DISMISSED_KEY, '1');
  };

  if (!prompt && !iosHint) return null;

  return (
    <div
      role="dialog"
      aria-label="Install SmartFolio"
      className="fixed inset-x-4 z-[100] mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-white/95 p-4 shadow-lg ring-1 ring-black/5 backdrop-blur"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
    >
      <img src="/icons/icon-192.png" alt="" className="h-10 w-10 shrink-0 rounded-xl" />
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-900">Install SmartFolio</p>
        <p className="text-xs text-gray-600">
          {iosHint ? 'Tap Share, then “Add to Home Screen”.' : 'Use it like an app, straight from your home screen.'}
        </p>
      </div>
      {!iosHint && (
        <button
          type="button"
          onClick={install}
          className="shrink-0 rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
        >
          Install
        </button>
      )}
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="shrink-0 rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
      >
        ✕
      </button>
    </div>
  );
}
