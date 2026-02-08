"use client";

import { formatCurrency } from '@/lib/formatters';

interface ChartTooltipRow {
  label: string;
  value: string;
}

interface ChartTooltipContentProps {
  title: string;
  rows: ChartTooltipRow[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface RechartsTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<{ payload: any }>;
}

export const ChartTooltipContent = ({ title, rows }: ChartTooltipContentProps) => (
  <div className="bg-slate-800 text-white rounded-lg px-3 py-2 text-xs shadow-lg">
    <p className="font-semibold mb-1">{title}</p>
    {rows.map((row, i) => (
      <div key={i} className="flex justify-between gap-4 text-slate-300">
        <span>{row.label}</span>
        <span className="font-medium text-white">{row.value}</span>
      </div>
    ))}
  </div>
);

export const PipelineTooltip = ({ active, payload }: RechartsTooltipProps) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <ChartTooltipContent
      title={d.stage}
      rows={[
        { label: 'Deals', value: String(d.deals) },
        { label: 'Valor', value: formatCurrency(d.valor) },
        { label: 'Comissao', value: formatCurrency(d.comissao) },
      ]}
    />
  );
};

export const AgingTooltip = ({ active, payload }: RechartsTooltipProps) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <ChartTooltipContent
      title={d.bucket}
      rows={[
        { label: 'Deals', value: String(d.count) },
        { label: 'Valor', value: formatCurrency(d.valor) },
      ]}
    />
  );
};

export const CommissionTooltip = ({ active, payload }: RechartsTooltipProps) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <ChartTooltipContent
      title={d.label}
      rows={[
        { label: 'Deals', value: String(d.count) },
        { label: 'Comissao', value: formatCurrency(d.comissao) },
      ]}
    />
  );
};
