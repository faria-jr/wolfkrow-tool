import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,

  transpilePackages: ['@wolfkrow/design-tokens'],

  experimental: {
    serverActions: {
      bodySizeLimit: '5mb',
    },
    optimizePackageImports: [
      'lucide-react',
      'date-fns',
      'recharts',
      'd3',
      '@radix-ui/react-icons',
    ],
  },

  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=()' },
        ],
      },
      {
        source: '/api/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, private' },
          { key: 'X-Accel-Buffering', value: 'no' },
        ],
      },
    ];
  },

  async redirects() {
    return [
      { source: '/', destination: '/chat', permanent: false },
    ];
  },

  webpack: (config) => {
    config.externals.push({
      'better-sqlite3': 'commonjs better-sqlite3',
      keytar: 'commonjs keytar',
      'sqlite-vec': 'commonjs sqlite-vec',
    });
    return config;
  },

  output: 'standalone',
  poweredByHeader: false,
  compress: true,
  productionBrowserSourceMaps: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
