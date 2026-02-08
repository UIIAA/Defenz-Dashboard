"use client";

import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from 'recharts';

interface Props {
  healthPct: number;
  healthLabel: string;
  activeCount: number;
  staleCount: number;
}

function getHealthColor(pct: number) {
  if (pct >= 70) return '#10b981';
  if (pct >= 50) return '#f59e0b';
  return '#ef4444';
}

export const PipelineHealthChart = ({ healthPct, healthLabel, activeCount, staleCount }: Props) => {
  const color = getHealthColor(healthPct);
  const data = [{ value: healthPct, fill: color }];

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <div className="relative w-[180px] h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            innerRadius="75%"
            outerRadius="100%"
            data={data}
            startAngle={90}
            endAngle={-270}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
            <RadialBar
              background={{ fill: '#f1f5f9' }}
              dataKey="value"
              angleAxisId={0}
              cornerRadius={8}
            />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold font-display" style={{ color }}>
            {healthPct}%
          </span>
          <span className="text-xs text-slate-500 font-medium">{healthLabel}</span>
        </div>
      </div>
      <p className="text-xs text-slate-400 mt-2">
        {activeCount} ativos · {staleCount} parados
      </p>
    </div>
  );
};
