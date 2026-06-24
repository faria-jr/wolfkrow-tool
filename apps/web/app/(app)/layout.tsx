import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

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
      <AutoLock />
      <Sidebar />
      <SidebarInset>
        <Topbar />
        <CommandPalette />
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
