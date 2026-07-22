import FoliLoader from '@/components/foli/FoliLoader';

// Analysis results — Foli is excited to reveal your score.
export default function Loading() {
  return (
    <FoliLoader
      moods={['typing', 'happy', 'look-l', 'happy']}
      messages={['Crunching the numbers…', 'Scoring your resume…', 'Almost got your results…']}
    />
  );
}
