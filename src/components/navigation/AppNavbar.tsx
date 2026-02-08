"use client";

import { LogOut } from 'lucide-react';
import { DateFilter } from '@/components/ui/DateFilter';
import { NavLink } from './NavLink';
import { useDateRange } from '@/providers/DateRangeProvider';

export const AppNavbar = () => {
  const { dateRange, setDateRange } = useDateRange();

  return (
    <header className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between">
      <div>
        <div className="flex items-center gap-4">
          <h1 className="text-4xl font-semibold text-slate-900 tracking-tight font-display mb-1 flex items-baseline gap-1">
            Defenz<span className="text-red-600">.Dashboard</span>
          </h1>
          <nav className="hidden md:flex items-center gap-1 ml-4">
            <NavLink href="/">Executivo</NavLink>
            <NavLink href="/operacional">Operacional</NavLink>
            <NavLink href="/atividade">Atividade</NavLink>
            <NavLink href="/metas">Metas</NavLink>
          </nav>
        </div>
        <div className="flex items-center gap-3 text-slate-500 text-sm font-medium">
          <span className="w-2 h-2 rounded-full bg-red-600 shadow-[0_0_8px_rgba(220,38,38,0.4)] animate-pulse"></span>
          <p>Operacao Comercial</p>
        </div>
        {/* Mobile nav */}
        <nav className="flex md:hidden items-center gap-1 mt-3 flex-wrap">
          <NavLink href="/">Executivo</NavLink>
          <NavLink href="/operacional">Operacional</NavLink>
          <NavLink href="/atividade">Atividade</NavLink>
          <NavLink href="/metas">Metas</NavLink>
        </nav>
      </div>
      <div className="mt-6 md:mt-0 flex items-center gap-2">
        <DateFilter currentRange={dateRange} onRangeChange={setDateRange} />
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
