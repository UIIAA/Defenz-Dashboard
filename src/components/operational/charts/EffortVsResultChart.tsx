"use client";

import {
  BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer, LabelList,
} from 'recharts';
import type { ActivityMetrics } from '@/hooks/useActivityMetrics';

interface Props {
  metrics: ActivityMetrics | null;
}

interface FunnelRow {
  name: string;
  value: number;
  color: string;
}

const FUNNEL_COLORS: Record<string, string> = {
  ligacoes: '#ef4444',
  emails: '#f59e0b',
  reunioes: '#10b981',
  apresentacoes: '#6366f1',
  propostas: '#8b5cf6',
};

export const EffortVsResultChart = ({ metrics }: Props) => {
  if (!metrics) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-slate-400">
        Carregando...
      </div>
    );
  }

  const data: FunnelRow[] = [
    { name: 'Ligacoes', value: metrics.ligacoes, color: FUNNEL_COLORS.ligacoes },
    { name: 'Emails', value: metrics.emails, color: FUNNEL_COLORS.emails },
    { name: 'Reunioes', value: metrics.reunioes, color: FUNNEL_COLORS.reunioes },
    { name: 'Apresentacoes', value: metrics.apresentacoes, color: FUNNEL_COLORS.apresentacoes },
    { name: 'Propostas', value: metrics.propostas, color: FUNNEL_COLORS.propostas },
  ];

  const totalEffort = metrics.ligacoes + metrics.emails;
  const totalResult = metrics.reunioes;
  const conversionPct = totalEffort > 0 ? ((totalResult / totalEffort) * 100).toFixed(1) : '0';

  const hasData = data.some(d => d.value > 0);

  if (!hasData) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-slate-400">
        Nenhum dado
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 40, bottom: 0, left: 0 }}
          >
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="name"
              width={100}
              tick={{ fontSize: 11, fill: '#64748b' }}
              axisLine={false}
              tickLine={false}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={18}>
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
              <LabelList
                dataKey="value"
                position="right"
                style={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="text-center pt-2 border-t border-slate-100 mt-1">
        <span className="text-[11px] text-slate-400">
          Conversao:{' '}
          <span className="font-bold text-slate-700">{conversionPct}%</span>
          {' '}do esforco resultou em reunioes
        </span>
      </div>
    </div>
  );
};
