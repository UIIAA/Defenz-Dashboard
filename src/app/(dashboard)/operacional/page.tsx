import { redirect } from 'next/navigation';
import { verifySession, isSuperAdmin } from '@/lib/auth';
import { OperationalDashboard } from '@/components/operational/OperationalDashboard';

// Tela ainda não liberada pro time: esconder o link do menu não basta, porque digitar
// /operacional na barra de endereço abriria mesmo assim. O guard é aqui, no servidor.
export default async function OperacionalPage() {
  const session = await verifySession();
  if (!isSuperAdmin(session?.role)) redirect('/diario');
  return <OperationalDashboard />;
}
