"use client";

import { LogOut } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { DateFilter } from '@/components/ui/DateFilter';
import { NavLink } from './NavLink';
import { useDateRange } from '@/providers/DateRangeProvider';

interface AppNavbarProps {
  /**
   * Papel de topo (super_admin). Libera as telas ainda NÃO conferidas — Executivo e
   * Operacional. Vem do servidor via layout; o link some pra todo mundo que não é preview,
   * e a rota também barra (esconder o link não protege quem digita a URL).
   */
  preview?: boolean;
}

export const AppNavbar = ({ preview = false }: AppNavbarProps) => {
  const { dateRange, setDateRange } = useDateRange();
  const pathname = usePathname();
  // /diario tem seu próprio navegador; /metas usa semana ISO própria; /oportunidades mostra o
  // pipe ABERTO, que é um retrato do agora e não um intervalo — nos três o filtro de data
  // global não se aplica (seria um no-op confuso).
  const SEM_FILTRO_DATA = ['/diario', '/metas', '/oportunidades'];
  const showRangeFilter = !SEM_FILTRO_DATA.some((r) => pathname.startsWith(r));

  return (
    <header className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between">
      <div>
        <div className="flex items-center gap-4">
          <h1 className="text-4xl font-semibold text-slate-900 tracking-tight font-display mb-1 flex items-baseline gap-1">
            Defenz<span className="text-red-600">.Dashboard</span>
          </h1>
          <nav className="hidden md:flex items-center gap-1 ml-4">
            {preview && <NavLink href="/">Executivo</NavLink>}
            <NavLink href="/diario">Resumo Diário</NavLink>
            {preview && <NavLink href="/operacional">Operacional</NavLink>}
            <NavLink href="/oportunidades">Oportunidades</NavLink>
            <NavLink href="/metas">Metas</NavLink>
          </nav>
        </div>
        <div className="flex items-center gap-3 text-slate-500 text-sm font-medium">
          <span className="w-2 h-2 rounded-full bg-red-600 shadow-[0_0_8px_rgba(220,38,38,0.4)] animate-pulse"></span>
          <p>Operacao Comercial</p>
        </div>
        {/* Mobile nav */}
        <nav className="flex md:hidden items-center gap-1 mt-3 flex-wrap">
          {preview && <NavLink href="/">Executivo</NavLink>}
          <NavLink href="/diario">Resumo Diário</NavLink>
          {preview && <NavLink href="/operacional">Operacional</NavLink>}
          <NavLink href="/oportunidades">Oportunidades</NavLink>
          <NavLink href="/metas">Metas</NavLink>
        </nav>
      </div>
      <div className="mt-6 md:mt-0 flex items-center gap-2">
        {showRangeFilter && <DateFilter currentRange={dateRange} onRangeChange={setDateRange} />}
        <a
          href="/api/auth/logout"
          className="p-2 bg-white/80 border border-slate-200/60 rounded-full hover:bg-red-50 hover:border-red-200 transition-all text-slate-400 hover:text-red-600 shadow-sm"
          title="Sair"
        >
          <LogOut size={16} />
        </a>
      </div>
    </header>
  );
};
