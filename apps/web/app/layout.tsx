import type { Metadata, Viewport } from 'next';

import { QueryProvider } from '@/components/common/query-provider';
import { ThemeProvider } from '@/components/common/theme-provider';
import { Toaster } from '@/components/ui/sonner';

import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Wolfkrow Tool',
    template: '%s · Wolfkrow Tool',
  },
  description:
    'Personal AI assistant desktop app — self-hosted, single-user. Multi-SDK chat, knowledge base, harness system, voice conversation, and more.',
  applicationName: 'Wolfkrow Tool',
  authors: [{ name: 'Wolfkrow Labs' }],
  generator: 'Wolfkrow Tool',
  keywords: [
    'AI assistant',
    'Claude',
    'GPT',
    'self-hosted',
    'knowledge base',
    'RAG',
    'voice assistant',
    'desktop app',
    'PWA',
  ],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Wolfkrow',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fafafa' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&family=JetBrains+Mono:wght@100..800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-background min-h-screen font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>{children}</QueryProvider>
          <Toaster richColors closeButton position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
