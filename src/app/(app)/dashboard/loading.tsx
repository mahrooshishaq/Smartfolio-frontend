import FoliLoader from '@/components/foli/FoliLoader';

// Dashboard — a cheerful welcome back.
export default function Loading() {
  return (
    <FoliLoader
      moods={['happy', 'look-r', 'idle', 'happy']}
      messages={['Loading your dashboard…', 'Pulling your latest progress…', 'Almost there…']}
    />
  );
}
