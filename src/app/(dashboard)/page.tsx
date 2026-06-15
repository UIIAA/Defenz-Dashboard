import { redirect } from 'next/navigation';

// Nesta fase só o Resumo Diário está liberado — o dashboard executivo
// continua no código (ExecutiveDashboard) mas a home abre o /diario.
export default function HomePage() {
  redirect('/diario');
}
