import { redirect } from 'next/navigation';
import { verifySession, isSuperAdmin } from '@/lib/auth';
import { ExecutiveDashboard } from '@/components/dashboard/ExecutiveDashboard';

// A home era `redirect('/diario')` fixo — o Executivo existia no código mas era inalcançável.
// Agora: super_admin vê o Executivo; todo o resto continua indo pro /diario, exatamente como
// antes. O Executivo segue fechado pro time porque os números dele ainda não foram conferidos
// (a comissão de agosto está inflada — ver docs/features/feature-migracao-neon-fase2.md §1).
export default async function HomePage() {
  const session = await verifySession();
  if (!isSuperAdmin(session?.role)) redirect('/diario');
  return <ExecutiveDashboard />;
}
