import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { ActiveRunsBar } from '@/components/common/active-runs-bar';
import { AutoLock } from '@/components/common/auto-lock';
import { CommandPalette } from '@/components/common/command-palette';
import { Sidebar } from '@/components/common/sidebar';
import { Topbar } from '@/components/common/topbar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { getSession } from '@/lib/auth';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get('session')?.value);
  if (!session) redirect('/login');

  return (
    <SidebarProvider defaultOpen>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:shadow"
      >
        Skip to content
      </a>
      <AutoLock />
      <Sidebar />
      <SidebarInset>
        <Topbar />
        <CommandPalette />
        {/* EPIC 2.1 — bounded scroll region: SidebarInset is the flex/h-svh
            column; this div is the flex-1 overflow boundary so each page's
            PageShell/PageContent scrolls internally instead of the window.
            (SidebarInset itself renders the single <main> landmark.) */}
        <div id="main-content" tabIndex={-1} className="flex-1 min-h-0 overflow-hidden">
          {children}
        </div>
        {/* DEBT #13 — global active-runs strip (hidden when no runs in flight). */}
        <ActiveRunsBar />
      </SidebarInset>
    </SidebarProvider>
  );
}
