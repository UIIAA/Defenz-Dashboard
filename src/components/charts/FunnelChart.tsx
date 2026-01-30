"use client";

import React, { useState, useRef } from 'react';
import { MagicCard } from '@/components/ui/MagicCard';
import { Filter, Info } from 'lucide-react';

interface FunnelStep {
    name: string;
    value: number;
    fill: string;
    label: string;
}

interface FunnelChartProps {
    data: FunnelStep[];
}

interface TooltipState {
    text: string;
    x: number;
    y: number;
}

export const FunnelChart = ({ data }: FunnelChartProps) => {
    const [showLegend, setShowLegend] = useState(false);
    const [tooltip, setTooltip] = useState<TooltipState | null>(null);
    const svgRef = useRef<SVGSVGElement>(null);

    if (!data || data.length === 0) {
        return (
            <div className="h-full w-full flex items-center justify-center text-slate-600 text-xs">
                Sem dados para o funil
            </div>
        );
    }

    const showTooltip = (text: string, e: React.MouseEvent<SVGElement>) => {
        const svg = svgRef.current;
        if (!svg) return;
        const rect = svg.getBoundingClientRect();
        setTooltip({
            text,
            x: e.clientX - rect.left,
            y: e.clientY - rect.top - 10,
        });
    };

    const hideTooltip = () => setTooltip(null);

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

    const blobPath = (cx: number, ry: number) => {
        const k = 0.5522847498;
        const rx = blobRX;
        return [
            `M${cx - rx},${cy}`,
            `C${cx - rx},${cy - ry * k} ${cx - rx * k},${cy - ry} ${cx},${cy - ry}`,
            `C${cx + rx * k},${cy - ry} ${cx + rx},${cy - ry * k} ${cx + rx},${cy}`,
            `C${cx + rx},${cy + ry * k} ${cx + rx * k},${cy + ry} ${cx},${cy + ry}`,
            `C${cx - rx * k},${cy + ry} ${cx - rx},${cy + ry * k} ${cx - rx},${cy}Z`,
        ].join(' ');
    };

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
                        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest font-display flex items-center gap-2">
                            <Filter size={16} className="text-red-500" />
                            Funil de Vendas
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">Conversão de contatos em negócios fechados</p>
                    </div>
                    <div className="relative">
                        <button
                            onClick={() => setShowLegend(!showLegend)}
                            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                            title="Entender os percentuais"
                        >
                            <Info size={16} />
                        </button>
                        {showLegend && (
                            <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-slate-200 rounded-lg shadow-lg p-4 z-50 text-left">
                                <p className="text-xs font-bold text-slate-700 mb-3 uppercase tracking-wider">Como ler os percentuais</p>
                                <div className="space-y-3">
                                    <div className="flex items-start gap-2">
                                        <span className="mt-0.5 shrink-0 w-5 h-5 rounded bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500">%</span>
                                        <div>
                                            <p className="text-xs font-semibold text-slate-700">% dentro do blob</p>
                                            <p className="text-[11px] text-slate-500 leading-snug">Proporção em relação ao topo do funil (Abordagens). Ex: 1.4% = apenas 1.4% dos contatos iniciais chegaram a essa etapa.</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <span className="mt-0.5 shrink-0 w-5 h-5 rounded bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-400">&#8594;</span>
                                        <div>
                                            <p className="text-xs font-semibold text-slate-700">% entre etapas</p>
                                            <p className="text-[11px] text-slate-500 leading-snug">Taxa de passagem de uma etapa para a seguinte. Ex: 300% = a próxima etapa tem 3x mais que a anterior (o funil cresce nesse ponto).</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex-1 w-full min-h-0 relative">
                    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="w-full h-full">
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
                            return <line key={i} x1={x} y1={labelY + 16} x2={x} y2={valueY - 16} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4 4" />;
                        })}

                        {/* Connections */}
                        {stages.slice(0, -1).map((s, i) => (
                            <path key={i} d={connectionPath(s, stages[i + 1])} fill={`url(#cg${i})`} />
                        ))}

                        {/* Blobs */}
                        {stages.map((s, i) => (
                            <path key={i} d={blobPath(s.cx, s.ry)} fill={s.fill} opacity="0.9" />
                        ))}

                        {/* Labels */}
                        {stages.map((s, i) => (
                            <text key={i} x={s.cx} y={labelY} textAnchor="middle" fill="#475569" fontSize="13" fontWeight="600">{s.label}</text>
                        ))}

                        {/* Stage-to-stage conversion rates (between blobs) */}
                        {stages.slice(1).map((s, i) => {
                            const prev = stages[i];
                            const rate = prev.value > 0 ? ((s.value / prev.value) * 100) : 0;
                            const midX = (prev.cx + s.cx) / 2;
                            const rateLabel = rate % 1 === 0 ? `${rate.toFixed(0)}%` : `${rate.toFixed(1)}%`;
                            const tip = rate > 100
                                ? `${s.label} tem ${(rate / 100).toFixed(1)}x mais que ${prev.label} (${prev.value} \u2192 ${s.value})`
                                : `${rateLabel} de ${prev.label} converteram em ${s.label} (${prev.value} \u2192 ${s.value})`;
                            return (
                                <text key={`s2s-${i}`} x={midX} y={cy - Math.max(prev.ry, s.ry) - 16}
                                      textAnchor="middle" fill="#94a3b8" fontSize="11" fontWeight="600"
                                      style={{ cursor: 'help' }}
                                      onMouseEnter={(e) => showTooltip(tip, e)}
                                      onMouseLeave={hideTooltip}>
                                    {rateLabel}
                                </text>
                            );
                        })}

                        {/* Percentages relative to top of funnel */}
                        {stages.map((s, i) => {
                            const isSmall = s.ry < 25;
                            const pctLabel = s.pct % 1 === 0 ? `${s.pct.toFixed(0)}%` : `${s.pct.toFixed(1)}%`;
                            const tip = i === 0
                                ? `${s.label}: ${s.value} (topo do funil, refer\u00EAncia 100%)`
                                : `${s.label} representa ${pctLabel} do total de ${stages[0].label} (${s.value} de ${stages[0].value})`;
                            return (
                                <text key={i} x={s.cx} y={isSmall ? cy - s.ry - 10 : cy + 6}
                                      textAnchor="middle"
                                      fill={isSmall ? s.fill : "white"}
                                      fontSize={isSmall ? "13" : "15"}
                                      fontWeight="700"
                                      style={isSmall ? { cursor: 'help' } : { textShadow: '0px 1px 2px rgba(0,0,0,0.1)', cursor: 'help' }}
                                      onMouseEnter={(e) => showTooltip(tip, e)}
                                      onMouseLeave={hideTooltip}>
                                    {pctLabel}
                                </text>
                            );
                        })}

                        {/* Absolute values */}
                        {stages.map((s, i) => (
                            <text key={i} x={s.cx} y={valueY} textAnchor="middle" fill="#94a3b8" fontSize="13" fontWeight="500">{s.value}</text>
                        ))}
                    </svg>

                    {/* HTML tooltip overlay */}
                    {tooltip && (
                        <div
                            className="absolute pointer-events-none z-50 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg shadow-lg max-w-[240px] leading-snug"
                            style={{
                                left: tooltip.x,
                                top: tooltip.y,
                                transform: 'translate(-50%, -100%)',
                            }}
                        >
                            {tooltip.text}
                            <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[5px] border-t-slate-800" />
                        </div>
                    )}
                </div>
            </div>
        </MagicCard>
    );
};
