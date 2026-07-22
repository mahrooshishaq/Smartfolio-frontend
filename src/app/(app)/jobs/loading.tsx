import FoliLoader from '@/components/foli/FoliLoader';

// Searching for jobs — Foli looks around, scouting.
export default function Loading() {
  return (
    <FoliLoader
      moods={['look-l', 'look-r', 'idle', 'look-r']}
      messages={['Scouting fresh roles…', 'Matching jobs to your resume…', 'Almost there…']}
    />
  );
}
