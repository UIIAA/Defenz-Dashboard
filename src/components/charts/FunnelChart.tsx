"use client";

import React from 'react';
import { MagicCard } from '@/components/ui/MagicCard';
import { Filter } from 'lucide-react';

interface FunnelStep {
    name: string;
    value: number;
    fill: string;
    label: string;
}

interface FunnelChartProps {
    data: FunnelStep[];
}

export const FunnelChart = ({ data }: FunnelChartProps) => {
    if (!data || data.length === 0) {
        return (
            <div className="h-full w-full flex items-center justify-center text-slate-600 text-xs">
                Sem dados para o funil
            </div>
        );
    }

    const maxVal = Math.max(...data.map(d => d.value), 1);
    const firstVal = data[0].value || 1;
    const n = data.length;

    const W = 800;
    const H = 380;
    const cy = H / 2 + 10;
    const labelY = 28;
    const valueY = H - 8;
    const padX = 20;
    const stageW = (W - padX * 2) / n;
    const maxRY = 110;
    const minRY = 2;
    const blobRX = stageW * 0.28;

    const stages = data.map((d, i) => {
        const ratio = maxVal > 0 ? d.value / maxVal : 0;
        const ry = minRY + ratio * (maxRY - minRY);
        const cx = padX + stageW * i + stageW / 2;
        const pct = i === 0 ? 100 : (firstVal > 0 ? (d.value / firstVal) * 100 : 0);
        return { cx, ry, ratio, pct, ...d };
    });

    // Ellipse blob path via cubic bezier (standard ellipse approximation)
    const blobPath = (cx: number, ry: number) => {
        const k = 0.5522847498; // kappa for circular arcs
        const rx = blobRX;
        return [
            `M${cx - rx},${cy}`,
            `C${cx - rx},${cy - ry * k} ${cx - rx * k},${cy - ry} ${cx},${cy - ry}`,
            `C${cx + rx * k},${cy - ry} ${cx + rx},${cy - ry * k} ${cx + rx},${cy}`,
            `C${cx + rx},${cy + ry * k} ${cx + rx * k},${cy + ry} ${cx},${cy + ry}`,
            `C${cx - rx * k},${cy + ry} ${cx - rx},${cy + ry * k} ${cx - rx},${cy}Z`,
        ].join(' ');
    };

    // Connection "tube" between two adjacent blobs with pinch effect
    const connectionPath = (a: typeof stages[0], b: typeof stages[0]) => {
        const x1 = a.cx + blobRX;
        const x2 = b.cx - blobRX;
        const midX = (x1 + x2) / 2;
        const h1 = a.ry * 0.35;
        const h2 = b.ry * 0.35;
        const pinch = Math.max(Math.min(h1, h2) * 0.12, 0.5);
        return [
            `M${x1},${cy - h1}`,
            `C${midX},${cy - h1 * 0.2} ${midX},${cy - pinch} ${midX},${cy - pinch}`,
            `C${midX},${cy - pinch} ${midX},${cy - h2 * 0.2} ${x2},${cy - h2}`,
            `L${x2},${cy + h2}`,
            `C${midX},${cy + h2 * 0.2} ${midX},${cy + pinch} ${midX},${cy + pinch}`,
            `C${midX},${cy + pinch} ${midX},${cy + h1 * 0.2} ${x1},${cy + h1}`,
            'Z',
        ].join(' ');
    };

    return (
        <MagicCard className="h-full p-6">
            <div className="h-full flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h3 className="text-sm font-bold text-slate-200 uppercase tracking-widest font-display flex items-center gap-2">
                            <Filter size={16} className="text-emerald-500" />
                            Funil de Vendas
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">Conversão de contatos em negócios fechados</p>
                    </div>
                </div>

                <div className="flex-1 w-full min-h-0">
                    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="w-full h-full">
                        <defs>
                            {stages.slice(0, -1).map((s, i) => (
                                <linearGradient key={i} id={`cg${i}`} x1="0" x2="1" y1="0" y2="0">
                                    <stop offset="0%" stopColor={s.fill} stopOpacity="0.5" />
                                    <stop offset="100%" stopColor={stages[i + 1].fill} stopOpacity="0.5" />
                                </linearGradient>
                            ))}
                        </defs>

                        {/* Divider lines */}
                        {stages.slice(1).map((_, i) => {
                            const x = padX + stageW * (i + 1);
                            return <line key={i} x1={x} y1={labelY + 16} x2={x} y2={valueY - 16} stroke="#334155" strokeWidth="1" strokeDasharray="4 4" opacity="0.4" />;
                        })}

                        {/* Connections */}
                        {stages.slice(0, -1).map((s, i) => (
                            <path key={i} d={connectionPath(s, stages[i + 1])} fill={`url(#cg${i})`} />
                        ))}

                        {/* Blobs */}
                        {stages.map((s, i) => (
                            <path key={i} d={blobPath(s.cx, s.ry)} fill={s.fill} opacity="0.85" />
                        ))}

                        {/* Labels */}
                        {stages.map((s, i) => (
                            <text key={i} x={s.cx} y={labelY} textAnchor="middle" fill="#cbd5e1" fontSize="13" fontWeight="600">{s.label}</text>
                        ))}

                        {/* Percentages */}
                        {stages.map((s, i) => (
                            <text key={i} x={s.cx} y={cy + 6} textAnchor="middle" fill="white" fontSize="15" fontWeight="700">
                                {s.pct % 1 === 0 ? `${s.pct.toFixed(0)}%` : `${s.pct.toFixed(1)}%`}
                            </text>
                        ))}

                        {/* Absolute values */}
                        {stages.map((s, i) => (
                            <text key={i} x={s.cx} y={valueY} textAnchor="middle" fill="#64748b" fontSize="13" fontWeight="500">{s.value}</text>
                        ))}
                    </svg>
                </div>
            </div>
        </MagicCard>
    );
};
