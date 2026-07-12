"use client";

import { useState, type ReactNode } from 'react';
import { startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { reduceTwoClicks, clampSelection, type RangeSelection } from '@/lib/date-range';

const toDate = (s: string) => new Date(`${s}T12:00:00`);
const toStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const selToRange = (sel: RangeSelection): DateRange =>
  sel.kind === 'dia'
    ? { from: toDate(sel.data), to: toDate(sel.data) }
    : { from: toDate(sel.from), to: toDate(sel.to) };

interface DateRangePickerProps {
  /** Seleção atual (para defaultMonth e destaque inicial). */
  value: RangeSelection;
  /** Piso e teto navegáveis (YYYY-MM-DD, BRT). Dias fora ficam desabilitados + clamp. */
  floor: string;
  today: string;
  /** Emite a seleção já clampada em [floor, today]. */
  onChange: (sel: RangeSelection) => void;
  /** Chrome do gatilho (cada tela passa o seu botão/label). */
  trigger: ReactNode;
  align?: 'start' | 'center' | 'end';
  hint?: string;
  disabled?: boolean;
}

// Núcleo reusável: popover + calendário mode=range + lógica de 1/2 cliques + Aplicar/Cancelar.
// Compartilhado por DayNavigator (Diário) e DateFilter (Exec/Operacional).
export function DateRangePicker({
  value,
  floor,
  today,
  onChange,
  trigger,
  align = 'center',
  hint = 'Clique 1 dia (= diário) ou 2 dias (= intervalo)',
  disabled,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<string | null>(null);
  const [range, setRange] = useState<DateRange | undefined>(undefined);

  const refDay = value.kind === 'dia' ? value.data : value.to;

  const reset = () => { setAnchor(null); setRange(undefined); };

  const handleDayClick = (clickedDate: Date) => {
    const clicked = toStr(startOfDay(clickedDate));
    const { anchor: nextAnchor, sel } = reduceTwoClicks(anchor, clicked);
    setAnchor(nextAnchor);
    setRange(selToRange(sel));
  };

  const apply = () => {
    if (!range?.from) return;
    const from = toStr(range.from);
    const to = toStr(range.to ?? range.from);
    onChange(clampSelection(from === to ? { kind: 'dia', data: from } : { kind: 'periodo', from, to }, floor, today));
    setOpen(false);
    reset();
  };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) reset(); }}>
      <PopoverTrigger asChild disabled={disabled}>
        {trigger}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align={align} sideOffset={8}>
        <div className="px-3 pt-2 text-[11px] text-slate-400">{hint}</div>
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
          <button onClick={() => { setOpen(false); reset(); }} className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700">Cancelar</button>
          <button onClick={apply} disabled={!range?.from} className="px-4 py-1.5 text-xs font-semibold bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed">Aplicar</button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
