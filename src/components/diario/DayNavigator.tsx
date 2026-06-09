"use client";

import { useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { addDays } from '@/lib/resumo-diario';

const toDate = (s: string) => new Date(`${s}T12:00:00`);
const toStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

interface DayNavigatorProps {
  data: string;
  floor: string;
  today: string;
  onChange: (data: string) => void;
  loading?: boolean;
}

export const DayNavigator = ({ data, floor, today, onChange, loading }: DayNavigatorProps) => {
  const [open, setOpen] = useState(false);

  const atFloor = data <= floor;
  const atCeiling = data >= today;

  const presets = [
    { label: 'Hoje', value: today },
    { label: 'Ontem', value: addDays(today, -1) },
    { label: '-2 dias', value: addDays(today, -2) },
    { label: 'Semana passada', value: addDays(today, -7) },
  ].filter(p => p.value >= floor);

  const label = (() => {
    try {
      return format(toDate(data), "dd 'de' MMMM yyyy", { locale: ptBR });
    } catch {
      return data;
    }
  })();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center bg-white/80 backdrop-blur-md border border-slate-200/60 rounded-full p-1 shadow-sm">
        <button
          aria-label="Dia anterior"
          disabled={atFloor || loading}
          onClick={() => onChange(addDays(data, -1))}
          className="p-1.5 rounded-full text-slate-500 hover:bg-slate-50 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={16} />
        </button>

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button className="px-3 py-1 flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-red-600 transition-colors">
              <CalendarDays size={14} className="text-red-500" />
              <span className="capitalize whitespace-nowrap">{label}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="center" sideOffset={8}>
            <Calendar
              mode="single"
              selected={toDate(data)}
              defaultMonth={toDate(data)}
              onSelect={(d) => {
                if (d) {
                  onChange(toStr(d));
                  setOpen(false);
                }
              }}
              disabled={{ before: toDate(floor), after: toDate(today) }}
              locale={ptBR}
            />
          </PopoverContent>
        </Popover>

        <button
          aria-label="Próximo dia"
          disabled={atCeiling || loading}
          onClick={() => onChange(addDays(data, 1))}
          className="p-1.5 rounded-full text-slate-500 hover:bg-slate-50 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="flex items-center gap-1">
        {presets.map(p => {
          const active = data === p.value;
          return (
            <button
              key={p.label}
              onClick={() => onChange(p.value)}
              disabled={loading}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors border ${
                active
                  ? 'text-red-700 font-bold bg-red-100/50 border-red-200 shadow-[0_0_8px_rgba(220,38,38,0.1)]'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 border-transparent'
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};
