'use client';

// Precached by the service worker and served when a navigation fails offline.
import Foli from '@/components/foli/Foli';

export default function Offline() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-2 px-6 text-center bg-[#f5f4fb]">
      <Foli state="sad" className="w-[150px] h-[150px]" />
      <h1 className="text-2xl font-bold text-gray-800 mt-2">You&apos;re offline</h1>
      <p className="text-gray-500 max-w-xs">
        Foli can&apos;t reach the internet right now. Reconnect and try again.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-4 py-3 px-6 text-white text-[15px] font-bold rounded-xl bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-500 shadow-lg shadow-purple-200 hover:brightness-105 active:translate-y-px transition"
      >
        Try again
      </button>
    </div>
  );
}
