import FoliLoader from '@/components/foli/FoliLoader';

// Resume editor — Foli opens up your resume.
export default function Loading() {
  return (
    <FoliLoader
      moods={['typing', 'look-r', 'typing', 'idle']}
      messages={['Opening your resume…', 'Loading the editor…', 'Almost ready…']}
    />
  );
}
