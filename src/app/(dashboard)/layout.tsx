import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ClientProviders } from './providers';
import { AppNavbar } from '@/components/navigation/AppNavbar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ErrorBoundary>
      <ClientProviders>
        <div className="min-h-screen p-4 md:p-8 font-sans bg-transparent text-slate-900">
          <div className="max-w-7xl mx-auto">
            <AppNavbar />
            <div className="min-h-[600px]">
              {children}
            </div>
          </div>
        </div>
      </ClientProviders>
    </ErrorBoundary>
  );
}
