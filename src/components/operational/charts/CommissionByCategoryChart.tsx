"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import type { CommissionCategoryData } from '@/hooks/useOperationalCharts';
import { CommissionTooltip } from './ChartTooltip';
import { formatCurrency } from '@/lib/formatters';

interface Props {
  data: CommissionCategoryData[];
  totalCommission: number;
}

export const CommissionByCategoryChart = ({ data, totalCommission }: Props) => {
  if (data.length === 0 || totalCommission === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-slate-400">
        Nenhum dado
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center h-full">
      <div className="relative w-full flex-1 min-h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="comissao"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={85}
              paddingAngle={2}
              strokeWidth={0}
            >
              {data.map((entry) => (
                <Cell key={entry.categoria} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip content={<CommissionTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-lg font-bold font-display text-slate-800">
            {formatCurrency(totalCommission)}
          </span>
          <span className="text-[10px] text-slate-400">Total</span>
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-3 mt-2">
        {data.map((entry) => (
          <div key={entry.categoria} className="flex items-center gap-1.5 text-xs text-slate-600">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: entry.fill }}
            />
            <span>{entry.label}</span>
            <span className="text-slate-400">({entry.count})</span>
          </div>
        ))}
      </div>
    </div>
  );
};
