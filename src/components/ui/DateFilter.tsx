"use client";

import { useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarDays } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { addDays, spanDays } from '@/lib/resumo-diario';
import { daySel, decodeCustom, encodeCustom, type RangeSelection } from '@/lib/date-range';

interface DateFilterProps {
    currentRange: string;
    onRangeChange: (range: string) => void;
    disabled?: boolean;
}

const RANGES = [
    { id: 'today', label: 'Hoje' },
    { id: '7d', label: '7 Dias' },
    { id: '15d', label: '15 Dias' },
    { id: '30d', label: '30 Dias' },
    { id: 'month', label: 'Este Mês' },
    { id: 'alltime', label: 'All time' },
];

// Piso generoso (não há dado antes de 2025) e teto = hoje (sem datas futuras).
const FLOOR = '2024-01-01';
const MAX_SPAN_DAYS = 366;

export const DateFilter = ({ currentRange, onRangeChange, disabled }: DateFilterProps) => {
    const [today] = useState(() => format(new Date(), 'yyyy-MM-dd'));

    const isCustom = currentRange.startsWith('custom:');
    const value: RangeSelection = isCustom ? decodeCustom(currentRange) : daySel(today);

    const handlePick = (sel: RangeSelection) => {
        // Preserva o guard de 366 dias do DateFilter antigo (clampa `from`, nunca gera range inválido).
        let out = sel;
        if (sel.kind === 'periodo' && spanDays(sel.from, sel.to) > MAX_SPAN_DAYS) {
            out = { kind: 'periodo', from: addDays(sel.to, -(MAX_SPAN_DAYS - 1)), to: sel.to };
        }
        onRangeChange(encodeCustom(out));
    };

    const customLabel = isCustom
        ? (() => {
            const [, from, to] = currentRange.split(':');
            const f = new Date(from + 'T12:00:00');
            const t = new Date(to + 'T12:00:00');
            return `${format(f, 'dd/MM', { locale: ptBR })} - ${format(t, 'dd/MM', { locale: ptBR })}`;
        })()
        : null;

    return (
        <div className="flex items-center bg-white/80 backdrop-blur-md border border-slate-200/60 rounded-full p-1 shadow-sm">
            <DateRangePicker
                value={value}
                floor={FLOOR}
                today={today}
                onChange={handlePick}
                align="start"
                disabled={disabled}
                trigger={
                    <button
                        className={`px-3 flex items-center border-r border-slate-200 mr-1 transition-colors ${
                            isCustom ? 'text-red-600' : 'text-red-500 hover:text-red-600'
                        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                        <CalendarDays size={14} strokeWidth={2} />
                        {customLabel && (
                            <span className="ml-1.5 text-[10px] font-semibold text-red-600 whitespace-nowrap">
                                {customLabel}
                            </span>
                        )}
                    </button>
                }
            />

            <div className="flex space-x-1">
                {RANGES.map((range) => {
                    const isActive = currentRange === range.id;
                    return (
                        <button
                            key={range.id}
                            onClick={() => onRangeChange(range.id)}
                            disabled={disabled}
                            className={`
                relative px-4 py-1.5 text-xs font-medium rounded-full transition-all duration-300
                ${isActive ? 'text-red-700 font-bold' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}
                ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
              `}
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="activeDateFilter"
                                    className="absolute inset-0 bg-red-100/50 border border-red-200 rounded-full shadow-[0_0_8px_rgba(220,38,38,0.1)]"
                                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                />
                            )}
                            <span className="relative z-10">{range.label}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
