import FoliLoader from '@/components/foli/FoliLoader';

// Mock interview — Foli concentrates, prepping.
export default function Loading() {
  return (
    <FoliLoader
      moods={['typing', 'idle', 'look-l', 'typing']}
      messages={['Setting up your interview…', 'Prepping your questions…', 'Take a breath — you’ve got this…']}
    />
  );
}
