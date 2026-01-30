"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarDays } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';

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
];

export const DateFilter = ({ currentRange, onRangeChange, disabled }: DateFilterProps) => {
    const [open, setOpen] = useState(false);
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

    const isCustom = currentRange.startsWith('custom:');

    const handleApply = () => {
        if (dateRange?.from) {
            const from = dateRange.from;
            const to = dateRange.to ?? from;
            // Validate: from must be <= to, max 366 days range
            if (from > to) return;
            const diffMs = to.getTime() - from.getTime();
            const diffDays = diffMs / (1000 * 60 * 60 * 24);
            if (diffDays > 366) return;
            const fromStr = format(from, 'yyyy-MM-dd');
            const toStr = format(to, 'yyyy-MM-dd');
            onRangeChange(`custom:${fromStr}:${toStr}`);
            setOpen(false);
        }
    };

    const handlePresetClick = (rangeId: string) => {
        setDateRange(undefined);
        onRangeChange(rangeId);
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
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <button
                        disabled={disabled}
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
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start" sideOffset={8}>
                    <Calendar
                        mode="range"
                        selected={dateRange}
                        onSelect={setDateRange}
                        numberOfMonths={1}
                        locale={ptBR}
                    />
                    <div className="p-3 border-t border-slate-200 flex justify-end gap-2">
                        <button
                            onClick={() => { setOpen(false); setDateRange(undefined); }}
                            className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleApply}
                            disabled={!dateRange?.from}
                            className="px-4 py-1.5 text-xs font-semibold bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            Aplicar
                        </button>
                    </div>
                </PopoverContent>
            </Popover>

            <div className="flex space-x-1">
                {RANGES.map((range) => {
                    const isActive = currentRange === range.id;
                    return (
                        <button
                            key={range.id}
                            onClick={() => handlePresetClick(range.id)}
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
