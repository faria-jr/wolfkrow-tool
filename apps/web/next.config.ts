import bundleAnalyzer from '@next/bundle-analyzer';
import withSerwistInit from '@serwist/next';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { NextConfig } from 'next';

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env['ANALYZE'] === 'true',
  openAnalyzer: false,
});

// EPIC 2.2 — read the version once at build time so the sidebar reflects the
// actual package version instead of a hard-coded literal. process.cwd() is the
// app dir (apps/web) during next build/dev.
const pkgVersion = (() => {
  try {
    return JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')).version as string;
  } catch {
    return '0.1.0';
  }
})();

const withSerwist = withSerwistInit({
  swSrc: 'src/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env['NODE_ENV'] === 'development',
});

const nextConfig: NextConfig = {
  reactStrictMode: true,

  env: {
    NEXT_PUBLIC_APP_VERSION: pkgVersion,
  },

  transpilePackages: ['@wolfkrow/design-tokens'],

  experimental: {
    serverActions: {
      bodySizeLimit: '5mb',
    },
    optimizePackageImports: ['lucide-react', 'date-fns', 'recharts', 'd3', '@radix-ui/react-icons'],
  },

  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },

  async headers() {
    const sidecarOrigin = process.env['NEXT_PUBLIC_SIDECAR_URL'] ?? 'http://localhost:5000';
    const workerOrigin = process.env['WORKER_URL'] ?? 'http://localhost:4000';

    // CSP: tight policy; add origins only as actually needed
    const csp = [
      "default-src 'self'",
      `connect-src 'self' ${workerOrigin} ${sidecarOrigin} wss://localhost:4000 ws://localhost:4000`,
      // 'unsafe-inline' required: Next.js App Router delivers RSC flight data via
      // inline <script>self.__next_f.push(...)</script> tags. Without it (or a nonce)
      // the RSC client can't read the payload -> "Connection closed" + blank page.
      // 'unsafe-eval' needed by Next.js in dev. For external exposure, switch to
      // per-request nonce-based CSP (generate in middleware, read in headers()).
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob:",
      "media-src 'self' blob:",
      `frame-src 'self' ${sidecarOrigin}`,
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      'upgrade-insecure-requests',
    ].join('; ');

    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
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
    return [{ source: '/', destination: '/dashboard', permanent: false }];
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

export default withBundleAnalyzer(withSerwist(nextConfig));
