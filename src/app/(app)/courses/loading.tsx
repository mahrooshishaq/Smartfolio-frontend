import FoliLoader from '@/components/foli/FoliLoader';

// Courses — Foli is keen to learn.
export default function Loading() {
  return (
    <FoliLoader
      moods={['happy', 'typing', 'look-r', 'happy']}
      messages={['Lining up courses…', 'Finding skills to level up…', 'Almost ready…']}
    />
  );
}
