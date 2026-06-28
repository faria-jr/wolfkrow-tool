# ADR-0019: PWA Installable como Distribuição Primária

**Status**: ✅ Aceito
**Data**: 2026-06-20

## Contexto

Além do Electron wrapper, queremos que usuários possam instalar o Wolfkrow Tool como PWA (Progressive Web App) para acesso rápido via browser sem Electron overhead.

## Decisão

**PWA installable** com Service Worker para offline shell + manifest.json para install prompt.

### `apps/web/public/manifest.json`

```json
{
  "name": "Wolfkrow Tool",
  "short_name": "Wolfkrow",
  "description": "Assistente pessoal de IA self-hosted",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0a0a0a",
  "theme_color": "#f59e0b",
  "lang": "pt-BR",
  "scope": "/",
  "icons": [
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/maskable-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ],
  "shortcuts": [
    {
      "name": "Chat",
      "url": "/chat",
      "icons": [{ "src": "/icons/shortcut-chat.png", "sizes": "96x96" }]
    },
    {
      "name": "Knowledge",
      "url": "/knowledge",
      "icons": [{ "src": "/icons/shortcut-knowledge.png", "sizes": "96x96" }]
    },
    {
      "name": "Scheduler",
      "url": "/scheduler",
      "icons": [{ "src": "/icons/shortcut-scheduler.png", "sizes": "96x96" }]
    }
  ],
  "categories": ["productivity", "developer", "utilities"]
}
```

### Service Worker (Serwist)

```typescript
// apps/web/app/sw.ts
import { defaultCache } from '@serwist/next/worker';
import { Serwist } from 'serwist';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Static assets (CacheFirst)
    {
      matcher: ({ request }) =>
        request.destination === 'style' ||
        request.destination === 'script' ||
        request.destination === 'font' ||
        request.destination === 'image',
      handler: 'CacheFirst',
      options: {
        cacheName: 'static-assets',
        expiration: { maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 }, // 30 days
      },
    },
    // API calls (NetworkFirst)
    {
      matcher: ({ url }) => url.pathname.startsWith('/api/'),
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-cache',
        networkTimeoutSeconds: 5,
        expiration: { maxEntries: 50, maxAgeSeconds: 5 * 60 }, // 5min
      },
    },
    // Pages (StaleWhileRevalidate)
    {
      matcher: ({ request }) => request.mode === 'navigate',
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'pages',
        expiration: { maxEntries: 50, maxAgeSeconds: 24 * 60 * 60 }, // 24h
      },
    },
    ...defaultCache,
  ],
});

serwist.addEventListeners();
```

## Consequências

### Positivas

- **Install to home screen**: Chrome mostra prompt "Install app"
- **Standalone window**: sem address bar, parece nativo
- **Offline shell**: HTML + CSS + JS cached
- **Cross-device**: mesmo PWA em mobile + desktop
- **Auto-update**: versioning via header cache invalidation
- **Smaller than Electron**: ~5MB vs ~150MB

### Negativas

- **Sem systray**: PWA não tem acesso
- **Sem hotkey global**: limitação do browser
- **Sem auto-launch**: browser-dependent
- **Sem file dialogs nativos**: File System Access API limitado
- **iOS Safari**: limita PWA (no background, limited storage)

### Mitigações

- Recomendar Electron para power users
- PWA para acesso rápido/mobile
- File picker via `<input type="file">` (universal)

## Icons

Necessários 8 ícones:

- 192x192, 512x512, 512x512 maskable
- 3 shortcut icons (96x96)

Gerados via `pwa-asset-generator` ou manualmente.

## Lighthouse PWA Score

Targets:

- Installable: ✅
- PWA Optimized: ✅
- Performance: ≥95
- Accessibility: ≥95
- Best Practices: ≥95
- SEO: ≥90

## Alternativas Consideradas

### A. Electron only

**Prós**: Full UX desktop
**Contras**: Sem mobile, sem quick browser install
**Decisão**: ✅ Mantido como opção (ADR-0018)

### B. Tauri PWA wrapper

**Prós**: Melhor de 2 mundos
**Contras**: Complexidade dupla
**Decisão**: 🤔 v2.0

### C. Capacitor (mobile wrapper)

**Prós**: Mobile app nativo
**Contras**: Não é desktop
**Decisão**: ❌ Mobile separado (v1.1+)

## References

- [PWA Docs](https://web.dev/progressive-web-apps/)
- [Serwist](https://serwist.pages.dev/)
- [Web App Manifest](https://www.w3.org/TR/appmanifest/)
- [Lighthouse PWA](https://developer.chrome.com/docs/lighthouse/pwa/)
