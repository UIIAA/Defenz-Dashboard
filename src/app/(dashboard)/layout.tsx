import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ClientProviders } from './providers';
import { AppNavbar } from '@/components/navigation/AppNavbar';
import { verifySession, isSuperAdmin } from '@/lib/auth';

// O papel vem do SERVIDOR e desce como prop. Buscar via /api/whoami no cliente faria os
// menus piscarem (renderiza escondido → aparece) e adicionaria um round-trip por página.
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await verifySession();
  const preview = isSuperAdmin(session?.role);

  return (
    <ErrorBoundary>
      <ClientProviders>
        <div className="min-h-screen p-4 md:p-8 font-sans bg-transparent text-slate-900">
          <div className="max-w-7xl mx-auto">
            <AppNavbar preview={preview} />
            <div className="min-h-[600px]">
              {children}
            </div>
          </div>
        </div>
      </ClientProviders>
    </ErrorBoundary>
  );
}
