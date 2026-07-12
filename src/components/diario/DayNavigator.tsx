"use client";

import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { addDays } from '@/lib/resumo-diario';
import type { RangeSelection } from '@/lib/date-range';

const toDate = (s: string) => new Date(`${s}T12:00:00`);
const fmtShort = (s: string) => { try { return format(toDate(s), 'dd/MM', { locale: ptBR }); } catch { return s; } };

// Modelo de seleção do Resumo Diário = a seleção compartilhada (dia | periodo).
export type DiarioView = RangeSelection;

interface DayNavigatorProps {
  view: DiarioView;
  floor: string;
  today: string;
  onDay: (data: string) => void;
  onRange: (from: string, to: string) => void;
  loading?: boolean;
}

export const DayNavigator = ({ view, floor, today, onDay, onRange, loading }: DayNavigatorProps) => {
  const isDia = view.kind === 'dia';
  const refDay = isDia ? view.data : view.to;
  const atFloor = refDay <= floor;
  const atCeiling = refDay >= today;
  const clampDay = (d: string) => (d < floor ? floor : d > today ? today : d);

  const firstOfMonth = today.slice(0, 8) + '01';
  const dayPresets = [
    { label: 'Hoje', day: today },
    { label: 'Ontem', day: addDays(today, -1) },
  ].filter(p => p.day >= floor);
  const rangePresets = [
    { label: '7 dias', from: clampDay(addDays(today, -6)), to: today },
    { label: '30 dias', from: clampDay(addDays(today, -29)), to: today },
    { label: 'Este mês', from: clampDay(firstOfMonth), to: today },
  ];

  const label = isDia
    ? (() => { try { return format(toDate(view.data), "dd 'de' MMMM yyyy", { locale: ptBR }); } catch { return view.data; } })()
    : `${fmtShort(view.from)} – ${fmtShort(view.to)}`;

  const onPick = (sel: RangeSelection) => {
    if (sel.kind === 'dia') onDay(sel.data);
    else onRange(sel.from, sel.to);
  };

  const presetBtn = (active: boolean, plabel: string, onClick: () => void) => (
    <button
      key={plabel}
      onClick={onClick}
      disabled={loading}
      className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors border ${
        active
          ? 'text-red-700 font-bold bg-red-100/50 border-red-200'
          : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 border-transparent'
      }`}
    >
      {plabel}
    </button>
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center bg-white/80 backdrop-blur-md border border-slate-200/60 rounded-full p-1 shadow-sm">
        <button
          aria-label="Dia anterior"
          disabled={!isDia || atFloor || loading}
          onClick={() => isDia && onDay(addDays(view.data, -1))}
          className="p-1.5 rounded-full text-slate-500 hover:bg-slate-50 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={16} />
        </button>

        <DateRangePicker
          value={view}
          floor={floor}
          today={today}
          onChange={onPick}
          disabled={loading}
          trigger={
            <button className="px-3 py-1 flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-red-600 transition-colors">
              <CalendarDays size={14} className="text-red-500" />
              <span className="capitalize whitespace-nowrap">{label}</span>
            </button>
          }
        />

        <button
          aria-label="Próximo dia"
          disabled={!isDia || atCeiling || loading}
          onClick={() => isDia && onDay(addDays(view.data, 1))}
          className="p-1.5 rounded-full text-slate-500 hover:bg-slate-50 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="flex items-center gap-1 flex-wrap">
        {dayPresets.map(p => presetBtn(isDia && view.data === p.day, p.label, () => onDay(p.day)))}
        <span className="w-px h-4 bg-slate-200 mx-1" />
        {rangePresets.map(p => presetBtn(!isDia && view.from === p.from && view.to === p.to, p.label, () => onRange(p.from, p.to)))}
      </div>
    </div>
  );
};
