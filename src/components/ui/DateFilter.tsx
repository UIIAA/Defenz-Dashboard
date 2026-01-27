"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { CalendarDays } from 'lucide-react';

interface DateFilterProps {
    currentRange: string;
    onRangeChange: (range: string) => void;
    disabled?: boolean;
}

const RANGES = [
    { id: '7d', label: '7 Dias' },
    { id: '15d', label: '15 Dias' },
    { id: '30d', label: '30 Dias' },
    { id: 'month', label: 'Este Mês' },
];

export const DateFilter = ({ currentRange, onRangeChange, disabled }: DateFilterProps) => {
    return (
        <div className="flex items-center bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-full p-1 shadow-lg">
            <div className="px-3 flex items-center text-slate-500 border-r border-white/5 mr-1">
                <CalendarDays size={14} strokeWidth={1.5} />
            </div>
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
                ${isActive ? 'text-white' : 'text-slate-500 hover:text-slate-300'}
                ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
              `}
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="activeDateFilter"
                                    className="absolute inset-0 bg-blue-600/20 border border-blue-500/30 rounded-full shadow-[0_0_10px_rgba(37,99,235,0.2)]"
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
