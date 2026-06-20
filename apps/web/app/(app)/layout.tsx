import { Sidebar } from '@/components/common/sidebar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  // TODO: Server Component: verificar session via cookie
  // const session = await getSession();
  // if (!session) redirect('/login');

  // Placeholder — substitui pela verificação real quando auth for implementado
  return (
    <SidebarProvider defaultOpen>
      <Sidebar />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
