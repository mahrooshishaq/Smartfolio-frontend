import FoliLoader from '@/components/foli/FoliLoader';

// Application tracker — Foli sorts through your pipeline.
export default function Loading() {
  return (
    <FoliLoader
      moods={['look-l', 'look-r', 'idle', 'typing']}
      messages={['Loading your applications…', 'Sorting your pipeline…', 'Almost ready…']}
    />
  );
}
