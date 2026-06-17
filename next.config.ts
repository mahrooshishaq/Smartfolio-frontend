import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  async rewrites() {
    return [
      { source: '/auth/:path*', destination: 'http://localhost:3001/auth/:path*' },
      { source: '/resume/:path*', destination: 'http://localhost:3001/resume/:path*' },
      { source: '/onboarding/:path*', destination: 'http://localhost:3001/onboarding/:path*' },
      { source: '/jobs/:path*', destination: 'http://localhost:3001/jobs/:path*' },
      { source: '/courses/:path*', destination: 'http://localhost:3001/courses/:path*' },
      { source: '/mock-interview/:path*', destination: 'http://localhost:3001/mock-interview/:path*' },
      { source: '/document-generation/:path*', destination: 'http://localhost:3001/document-generation/:path*' },
      { source: '/scraper/:path*', destination: 'http://localhost:3001/scraper/:path*' },
      { source: '/api/:path*', destination: 'http://localhost:3001/:path*' },
    ];
  },
};

export default nextConfig;
