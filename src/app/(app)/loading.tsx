import FoliLoader from '@/components/foli/FoliLoader';

// Shown while an authenticated app route (dashboard, jobs, courses…) loads.
export default function Loading() {
  return <FoliLoader messages={['Loading your workspace…', 'Fetching the latest…', 'Almost ready…']} />;
}
