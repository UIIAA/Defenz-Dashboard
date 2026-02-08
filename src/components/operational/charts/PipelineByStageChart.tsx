"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer } from 'recharts';
import type { PipelineStageData } from '@/hooks/useOperationalCharts';
import { PipelineTooltip } from './ChartTooltip';
import { formatCurrency } from '@/lib/formatters';

interface Props {
  data: PipelineStageData[];
  onStageClick?: (stage: string) => void;
}

export const PipelineByStageChart = ({ data, onStageClick }: Props) => {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-slate-400">
        Nenhum dado
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 0, right: 12, bottom: 0, left: 0 }}
      >
        <XAxis
          type="number"
          tickFormatter={(v: number) => formatCurrency(v)}
          tick={{ fontSize: 10, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="stage"
          width={110}
          tick={{ fontSize: 11, fill: '#64748b' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<PipelineTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
        <Bar
          dataKey="valor"
          radius={[0, 4, 4, 0]}
          cursor={onStageClick ? 'pointer' : undefined}
          onClick={(_barData: unknown, index: number) => {
            if (onStageClick && data[index]) onStageClick(data[index].stage);
          }}
        >
          {data.map((entry) => (
            <Cell key={entry.stage} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};
