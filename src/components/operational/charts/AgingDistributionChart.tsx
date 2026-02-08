"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer } from 'recharts';
import type { AgingBucketData } from '@/hooks/useOperationalCharts';
import { AgingTooltip } from './ChartTooltip';

interface Props {
  data: AgingBucketData[];
}

export const AgingDistributionChart = ({ data }: Props) => {
  const hasData = data.some(d => d.count > 0);

  if (!hasData) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-slate-400">
        Nenhum dado
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
        <XAxis
          dataKey="bucket"
          tick={{ fontSize: 10, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 10, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<AgingTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {data.map((entry) => (
            <Cell key={entry.bucket} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};
