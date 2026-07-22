import FoliLoader from '@/components/foli/FoliLoader';

// Onboarding — a warm, welcoming Foli.
export default function Loading() {
  return (
    <FoliLoader
      moods={['happy', 'idle', 'look-r', 'happy']}
      messages={['Setting things up…', 'Personalizing your space…', 'Almost ready…']}
    />
  );
}
