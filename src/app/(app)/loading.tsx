import FoliLoader from '@/components/foli/FoliLoader';

// Fallback for authenticated app routes that don't define their own loader.
export default function Loading() {
  return (
    <FoliLoader
      moods={['idle', 'look-r', 'happy', 'look-l']}
      messages={['Loading your workspace…', 'Fetching the latest…', 'Almost ready…']}
    />
  );
}
