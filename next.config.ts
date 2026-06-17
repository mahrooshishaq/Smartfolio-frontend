import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    return [
      { source: '/auth/:path*', destination: `${backendUrl}/auth/:path*` },
      { source: '/resume/:path*', destination: `${backendUrl}/resume/:path*` },
      { source: '/onboarding/:path*', destination: `${backendUrl}/onboarding/:path*` },
      { source: '/jobs/:path*', destination: `${backendUrl}/jobs/:path*` },
      { source: '/courses/:path*', destination: `${backendUrl}/courses/:path*` },
      { source: '/mock-interview/:path*', destination: `${backendUrl}/mock-interview/:path*` },
      { source: '/document-generation/:path*', destination: `${backendUrl}/document-generation/:path*` },
      { source: '/scraper/:path*', destination: `${backendUrl}/scraper/:path*` },
      { source: '/api/:path*', destination: `${backendUrl}/:path*` },
    ];
  },
};

export default nextConfig;
