import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  async headers() {
    const webOrigin = process.env['WEB_ORIGIN'] ?? 'http://localhost:3000';
    return [
      {
        // Allow the web app to embed this sidecar in an iframe.
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: `ALLOW-FROM ${webOrigin}` },
          { key: 'Content-Security-Policy', value: `frame-ancestors ${webOrigin}` },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
    ];
  },

  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
