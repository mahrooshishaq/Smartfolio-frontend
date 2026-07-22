import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'SmartFolio - AI',
    short_name: 'SmartFolio',
    description: 'Job Hunting Made Simple',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    // Matches the top of the in-app splash gradient so Chrome's auto-generated
    // native splash blends straight into our overlay with no colour jump.
    background_color: '#eef1ff',
    theme_color: '#eef1ff',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
