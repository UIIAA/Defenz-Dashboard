"use client";

import { useState, useRef } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { format, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { addDays } from '@/lib/resumo-diario';

const toDate = (s: string) => new Date(`${s}T12:00:00`);
const toStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fmtShort = (s: string) => { try { return format(toDate(s), 'dd/MM', { locale: ptBR }); } catch { return s; } };

export type DiarioView =
  | { kind: 'dia'; data: string }
  | { kind: 'periodo'; from: string; to: string };

interface DayNavigatorProps {
  view: DiarioView;
  floor: string;
  today: string;
  onDay: (data: string) => void;
  onRange: (from: string, to: string) => void;
  loading?: boolean;
}

export const DayNavigator = ({ view, floor, today, onDay, onRange, loading }: DayNavigatorProps) => {
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<DateRange | undefined>(undefined);
  const phase = useRef<'idle' | 'from'>('idle');

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

  const handleDayClick = (clickedDate: Date) => {
    const clicked = startOfDay(clickedDate);
    if (phase.current === 'idle') {
      setRange({ from: clicked, to: clicked });
      phase.current = 'from';
    } else {
      const f = range?.from ? startOfDay(range.from) : null;
      if (f && clicked.getTime() === f.getTime()) setRange({ from: clicked, to: clicked });
      else if (f) setRange(clicked < f ? { from: clicked, to: f } : { from: f, to: clicked });
      phase.current = 'idle';
    }
  };

  const applyCalendar = () => {
    if (!range?.from) return;
    const f = toStr(range.from);
    const t = toStr(range.to ?? range.from);
    setOpen(false);
    phase.current = 'idle';
    setRange(undefined);
    if (f === t) onDay(clampDay(f));
    else onRange(clampDay(f), clampDay(t));
  };

  const presetBtn = (active: boolean, label: string, onClick: () => void) => (
    <button
      key={label}
      onClick={onClick}
      disabled={loading}
      className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors border ${
        active
          ? 'text-red-700 font-bold bg-red-100/50 border-red-200'
          : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 border-transparent'
      }`}
    >
      {label}
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

        <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) { phase.current = 'idle'; setRange(undefined); } }}>
          <PopoverTrigger asChild>
            <button className="px-3 py-1 flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-red-600 transition-colors">
              <CalendarDays size={14} className="text-red-500" />
              <span className="capitalize whitespace-nowrap">{label}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="center" sideOffset={8}>
            <div className="px-3 pt-2 text-[11px] text-slate-400">Clique 1 dia (= diário) ou 2 dias (= intervalo)</div>
            <Calendar
              mode="range"
              selected={range}
              onSelect={() => {}}
              onDayClick={handleDayClick}
              defaultMonth={toDate(refDay)}
              disabled={{ before: toDate(floor), after: toDate(today) }}
              locale={ptBR}
            />
            <div className="p-3 border-t border-slate-200 flex justify-end gap-2">
              <button onClick={() => { setOpen(false); setRange(undefined); phase.current = 'idle'; }} className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700">Cancelar</button>
              <button onClick={applyCalendar} disabled={!range?.from} className="px-4 py-1.5 text-xs font-semibold bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed">Aplicar</button>
            </div>
          </PopoverContent>
        </Popover>

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
