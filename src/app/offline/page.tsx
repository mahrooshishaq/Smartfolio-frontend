// Precached by the service worker and served when a navigation fails offline.
export default function Offline() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-2xl font-bold">You&apos;re offline</h1>
      <p className="text-gray-600">
        SmartFolio needs a connection for this page. Reconnect and try again.
      </p>
    </div>
  );
}
