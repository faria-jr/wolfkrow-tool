/**
 * Wolfkrow PWA Service Worker — D.3
 *
 * Strategy:
 *  - API routes (/api/*)     → NetworkFirst (always try network, fall back to cache)
 *  - Static assets (_next/*) → CacheFirst (immutable hash-named files)
 *  - Images                  → StaleWhileRevalidate
 */

import { defaultCache } from '@serwist/next/worker';
import {
  CacheFirst,
  ExpirationPlugin,
  NetworkFirst,
  Serwist,
  StaleWhileRevalidate,
} from 'serwist';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const self: any;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: false,
  runtimeCaching: [
    {
      matcher: ({ url }: { url: URL }) => url.pathname.startsWith('/api/'),
      handler: new NetworkFirst({
        cacheName: 'wolfkrow-api',
        networkTimeoutSeconds: 10,
        plugins: [
          new ExpirationPlugin({ maxEntries: 256, maxAgeSeconds: 60 * 60 }),
        ],
      }),
    },
    {
      matcher: ({ url }: { url: URL }) => url.pathname.startsWith('/_next/static/'),
      handler: new CacheFirst({
        cacheName: 'wolfkrow-static',
        plugins: [
          new ExpirationPlugin({ maxEntries: 512, maxAgeSeconds: 60 * 60 * 24 * 365 }),
        ],
      }),
    },
    {
      matcher: ({ url }: { url: URL }) => url.pathname.startsWith('/_next/image'),
      handler: new StaleWhileRevalidate({
        cacheName: 'wolfkrow-images',
        plugins: [
          new ExpirationPlugin({ maxEntries: 128, maxAgeSeconds: 60 * 60 * 24 * 7 }),
        ],
      }),
    },
    ...defaultCache,
  ],
});

serwist.addEventListeners();
