import FoliLoader from '@/components/foli/FoliLoader';

// Upload resume — Foli watches for your file.
export default function Loading() {
  return (
    <FoliLoader
      moods={['look-l', 'look-r', 'idle', 'happy']}
      messages={['Getting ready for your resume…', 'Almost set…']}
    />
  );
}
