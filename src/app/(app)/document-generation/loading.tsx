import FoliLoader from '@/components/foli/FoliLoader';

// Document generation — Foli is busy writing.
export default function Loading() {
  return (
    <FoliLoader
      moods={['typing', 'typing', 'happy', 'look-r']}
      messages={['Warming up the writer…', 'Drafting your document…', 'Polishing the words…']}
    />
  );
}
