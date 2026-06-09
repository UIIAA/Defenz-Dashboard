"use client";

import { useState } from 'react';
import { ChevronDown, ChevronUp, Database } from 'lucide-react';
import type { CoverageReport, CoverageSourceStats } from '@/lib/types';

export type HealthStatus = 'ok' | 'partial' | 'empty';

export function getHealth(stats: CoverageSourceStats | undefined): HealthStatus {
  if (!stats) return 'empty';
  if (stats.in_range === 0) return 'empty';
  const total = stats.total || 1;
  if (stats.dropped_invalid_date / total > 0.10) return 'empty';
  if (stats.dropped_invalid_date > 0) return 'partial';
  return 'ok';
}

const HEALTH_DOT: Record<HealthStatus, string> = {
  ok: 'bg-green-500',
  partial: 'bg-yellow-400',
  empty: 'bg-red-500',
};

const HEALTH_LABEL: Record<HealthStatus, string> = {
  ok: 'Ok',
  partial: 'Parcial',
  empty: 'Vazio',
};

const HEALTH_TEXT: Record<HealthStatus, string> = {
  ok: 'text-green-600',
  partial: 'text-yellow-600',
  empty: 'text-red-600',
};

const SOURCES: { key: keyof CoverageReport; label: string; aba: string; coluna: string }[] = [
  { key: 'calls',           label: 'Ligações',         aba: 'ligacoes',          coluna: 'data' },
  { key: 'emails',          label: 'E-mails',           aba: 'emails',            coluna: 'data' },
  { key: 'deals',           label: 'Deals',             aba: 'deals',             coluna: 'closing_date' },
  { key: 'classificacoes',  label: 'Classificações IA', aba: 'classificacao_ia',  coluna: 'data_classificacao' },
  { key: 'reunioes',        label: 'Reuniões',          aba: 'reunioes',          coluna: 'data' },
];

interface DataHealthPanelProps {
  coverage: CoverageReport | null;
}

export function DataHealthPanel({ coverage }: DataHealthPanelProps) {
  const [open, setOpen] = useState(false);

  if (!coverage) return null;

  const statuses = SOURCES.map(s => getHealth(coverage[s.key]));
  const worstStatus: HealthStatus =
    statuses.some(s => s === 'empty') ? 'empty' :
    statuses.some(s => s === 'partial') ? 'partial' : 'ok';

  return (
    <div className="border border-slate-200/60 rounded-xl bg-white/60 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50/60 transition-colors text-left"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
          <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${HEALTH_DOT[worstStatus]}`} />
          <Database size={13} className="text-slate-400" />
          <span>Cobertura de Dados</span>
          {worstStatus !== 'ok' && (
            <span className={`text-xs font-normal ${HEALTH_TEXT[worstStatus]}`}>
              — {worstStatus === 'empty' ? 'fontes sem dados no período' : 'fontes com dados parciais'}
            </span>
          )}
        </div>
        {open
          ? <ChevronUp size={14} className="text-slate-400 flex-shrink-0" />
          : <ChevronDown size={14} className="text-slate-400 flex-shrink-0" />
        }
      </button>

      {open && (
        <div className="border-t border-slate-100 px-4 py-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {SOURCES.map(({ key, label, aba, coluna }) => {
              const stats = coverage[key];
              const health = getHealth(stats);
              return (
                <div
                  key={key}
                  className="flex flex-col gap-1.5 p-3 rounded-lg bg-slate-50/80 border border-slate-100"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-700 truncate">{label}</span>
                    <span className={`flex items-center gap-1 text-xs flex-shrink-0 ${HEALTH_TEXT[health]}`}>
                      <span className={`inline-block w-2 h-2 rounded-full ${HEALTH_DOT[health]}`} />
                      {HEALTH_LABEL[health]}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 space-y-0.5 leading-relaxed">
                    <div>
                      <span className="font-mono bg-slate-100 px-1 rounded text-slate-600">{aba}</span>
                      {' · '}
                      <span className="font-mono bg-slate-100 px-1 rounded text-slate-600">{coluna}</span>
                    </div>
                    {stats && (
                      <>
                        <div>
                          Total: <strong>{stats.total}</strong> · Período: <strong className={health === 'empty' ? 'text-red-600' : 'text-slate-700'}>{stats.in_range}</strong>
                        </div>
                        {stats.dropped_invalid_date > 0 && (
                          <div className="text-amber-600">
                            ⚠ Descartados: {stats.dropped_invalid_date}
                            {stats.total > 0 && ` (${Math.round(stats.dropped_invalid_date / stats.total * 100)}%)`}
                          </div>
                        )}
                        {(stats.min_date || stats.max_date) && (
                          <div className="text-slate-400">
                            {stats.min_date ?? '?'} → {stats.max_date ?? '?'}
                          </div>
                        )}
                        {stats.source && (
                          <div className="text-slate-400">
                            Via:{' '}
                            {stats.source === 'sheet' ? 'planilha' :
                             stats.source === 'resultados-proxy' ? 'proxy (resultados)' :
                             'indisponível'}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
