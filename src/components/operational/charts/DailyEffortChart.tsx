"use client";

import { useMemo } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { format, addDays, differenceInDays, startOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { DailyEffort } from '@/lib/types';

interface Props {
  /** Pre-aggregated daily effort data from the esforco_diario sheet */
  efpiData?: DailyEffort[];
  /** Optional date range filter (YYYY-MM-DD) */
  dataInicio?: string;
  dataFim?: string;
}

interface EffortRow {
  key: string;
  label: string;
  calls: number;
  emails: number;
  meetings: number;
  total: number;
}

const MIN_DAYS = 15;
const GROUP_BY_WEEK_THRESHOLD = 30;

function toSafeDate(dateStr: string) {
  return new Date(dateStr + 'T12:00:00');
}

/** Fill every day between inicio and fim (inclusive), defaulting missing days to 0 */
function zeroFillDays(data: DailyEffort[], inicio: string, fim: string): DailyEffort[] {
  const lookup = new Map<string, DailyEffort>();
  for (const d of data) {
    lookup.set(d.data, d);
  }

  const result: DailyEffort[] = [];
  const startDate = toSafeDate(inicio);
  const endDate = toSafeDate(fim);
  const days = differenceInDays(endDate, startDate);

  for (let i = 0; i <= days; i++) {
    const current = addDays(startDate, i);
    const key = format(current, 'yyyy-MM-dd');
    const existing = lookup.get(key);
    result.push(existing ?? { data: key, calls: 0, emails: 0, meetings: 0, total: 0 });
  }

  return result;
}

/** Ensure the range spans at least MIN_DAYS, expanding inicio backwards if needed */
function enforceMinDays(inicio: string, fim: string): { inicio: string; fim: string } {
  const startDate = toSafeDate(inicio);
  const endDate = toSafeDate(fim);
  const days = differenceInDays(endDate, startDate);

  if (days < MIN_DAYS - 1) {
    const newStart = addDays(endDate, -(MIN_DAYS - 1));
    return { inicio: format(newStart, 'yyyy-MM-dd'), fim };
  }
  return { inicio, fim };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const EffortTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as EffortRow | undefined;
  if (!d) return null;

  return (
    <div className="bg-slate-800 text-white rounded-lg px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold mb-1">{label}</p>
      <div className="space-y-0.5 text-slate-300">
        <div className="flex justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
            Ligacoes
          </span>
          <span className="font-medium text-white">{d.calls}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
            Emails
          </span>
          <span className="font-medium text-white">{d.emails}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            Reunioes
          </span>
          <span className="font-medium text-white">{d.meetings}</span>
        </div>
        <div className="flex justify-between gap-4 border-t border-slate-600 pt-1 mt-1">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />
            Total
          </span>
          <span className="font-medium text-white">{d.total}</span>
        </div>
      </div>
    </div>
  );
};

export const DailyEffortChart = ({ efpiData, dataInicio, dataFim }: Props) => {
  const data = useMemo<EffortRow[]>(() => {
    if (!efpiData || efpiData.length === 0) return [];

    // Determine effective date range
    let effectiveInicio = dataInicio ?? efpiData[0]?.data;
    let effectiveFim = dataFim ?? efpiData[efpiData.length - 1]?.data;
    if (!effectiveInicio || !effectiveFim) return [];

    // Enforce minimum 15 days
    const adjusted = enforceMinDays(effectiveInicio, effectiveFim);
    effectiveInicio = adjusted.inicio;
    effectiveFim = adjusted.fim;

    // Filter source data to the effective range
    const filtered = efpiData.filter(e => e.data >= effectiveInicio && e.data <= effectiveFim);

    // Zero-fill all days in range
    const filled = zeroFillDays(filtered, effectiveInicio, effectiveFim);

    const totalDays = filled.length;

    // Group by week if > 30 days
    if (totalDays > GROUP_BY_WEEK_THRESHOLD) {
      const weekMap = new Map<string, { calls: number; emails: number; meetings: number; weekStart: Date }>();
      for (const entry of filled) {
        const date = toSafeDate(entry.data);
        const ws = startOfWeek(date, { weekStartsOn: 1 });
        const weekKey = ws.toISOString().split('T')[0];
        const existing = weekMap.get(weekKey) || { calls: 0, emails: 0, meetings: 0, weekStart: ws };
        existing.calls += entry.calls;
        existing.emails += entry.emails;
        existing.meetings += entry.meetings;
        weekMap.set(weekKey, existing);
      }
      return Array.from(weekMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, e]) => ({
          key,
          label: `Sem ${format(e.weekStart, 'dd/MM', { locale: ptBR })}`,
          calls: e.calls,
          emails: e.emails,
          meetings: e.meetings,
          total: e.calls + e.emails + e.meetings,
        }));
    }

    return filled.map(e => ({
      key: e.data,
      label: format(toSafeDate(e.data), 'dd/MM', { locale: ptBR }),
      calls: e.calls,
      emails: e.emails,
      meetings: e.meetings,
      total: e.calls + e.emails + e.meetings,
    }));
  }, [efpiData, dataInicio, dataFim]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-slate-400">
        Nenhuma atividade no periodo
      </div>
    );
  }

  // Smart XAxis interval: avoid label overlap for many data points
  const xInterval = data.length > 20 ? Math.ceil(data.length / 10) - 1 : data.length > 15 ? 1 : 0;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
          interval={xInterval}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 10, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<EffortTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="calls" name="Ligacoes" fill="#ef4444" barSize={6} radius={[2, 2, 0, 0]} />
        <Bar dataKey="emails" name="Emails" fill="#f59e0b" barSize={6} radius={[2, 2, 0, 0]} />
        <Bar dataKey="meetings" name="Reunioes" fill="#10b981" barSize={6} radius={[2, 2, 0, 0]} />
        <Line
          type="monotone"
          dataKey="total"
          name="Total"
          stroke="#94a3b8"
          strokeWidth={1.5}
          strokeDasharray="4 4"
          dot={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
};
