"use client";

import { Shield, PhoneForwarded, UserCheck, Target, Swords, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { MagicCard } from '@/components/ui/MagicCard';
import { StatCard } from '@/components/dashboard/StatCard';
import type { EsforcoData } from '@/lib/types';

interface EsforcoSectionProps {
  data: EsforcoData;
  loading: boolean;
}

const FUNNEL_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981'];

const RespostaBar = ({ label, count, maxCount }: { label: string; count: number; maxCount: number }) => {
  const width = maxCount > 0 ? Math.max((count / maxCount) * 100, 4) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-500 w-32 shrink-0 text-right truncate">{label}</span>
      <div className="flex-1 h-6 bg-slate-50 rounded-md overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${width}%` }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="h-full bg-gradient-to-r from-red-400 to-red-500 rounded-md"
        />
      </div>
      <span className="text-xs font-semibold text-slate-700 w-8 tabular-nums">{count}</span>
    </div>
  );
};

const FunnelBar = ({ step, index, maxValue }: {
  step: { label: string; value: number; percent: number };
  index: number;
  maxValue: number;
}) => {
  const width = maxValue > 0 ? Math.max((step.value / maxValue) * 100, 6) : 0;
  const color = FUNNEL_COLORS[index] || FUNNEL_COLORS[4];
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-500 w-36 shrink-0 text-right truncate">{step.label}</span>
      <div className="flex-1 h-7 bg-slate-50 rounded-md overflow-hidden relative">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${width}%` }}
          transition={{ duration: 0.7, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
          className="h-full rounded-md"
          style={{ backgroundColor: color, opacity: 0.85 }}
        />
        <span className="absolute inset-y-0 left-2 flex items-center text-xs font-semibold text-white drop-shadow-sm">
          {step.value > 0 && step.value}
        </span>
      </div>
      <span className="text-xs font-semibold text-slate-500 w-10 tabular-nums">{step.percent}%</span>
    </div>
  );
};

export const EsforcoSection = ({ data, loading }: EsforcoSectionProps) => {
  const { metrics, funnel, respostas, concorrentes } = data;

  if (loading) {
    return (
      <MagicCard className="border-slate-200/60 bg-white/60">
        <div className="p-6 flex items-center justify-center h-48">
          <Loader2 size={24} className="animate-spin text-slate-300" />
        </div>
      </MagicCard>
    );
  }

  if (metrics.deals_com_resultados === 0) {
    return null;
  }

  const maxRespostaCount = respostas.length > 0 ? respostas[0].count : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-4"
    >
      {/* Section title */}
      <div className="flex items-center gap-2">
        <Shield size={16} className="text-red-500" />
        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 font-display">
          Funil de Esforco Comercial
        </h2>
        <span className="text-xs text-slate-400">
          ({metrics.deals_com_resultados} leads analisados por IA)
        </span>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          loading={loading}
          icon={PhoneForwarded}
          title="Gatekeeper"
          value={`${metrics.taxa_gatekeeper}%`}
          subtext="passam da secretaria"
          tooltip="Percentual de deals onde o vendedor ultrapassou a secretaria/recepcao e alcancou alguem da area tecnica ou de decisao."
        />
        <StatCard
          loading={loading}
          icon={UserCheck}
          title="Taxa Decisor"
          value={`${metrics.taxa_decisor}%`}
          subtext="chegam ao tecnico/decisor"
          tooltip="Percentual de deals onde o contato atingiu nivel de tecnico de TI ou decisor (gerente/diretor)."
        />
        <StatCard
          loading={loading}
          icon={Target}
          title="Toques Medio"
          value={String(metrics.toques_medio)}
          subtext="tentativas por deal"
          tooltip="Media de tentativas de contato (ligacoes, emails, mensagens) por deal classificado."
        />
        <StatCard
          loading={loading}
          icon={Swords}
          title="Concorrentes"
          value={String(metrics.deals_com_concorrente)}
          subtext={metrics.concorrente_top1 !== '-' ? `#1: ${metrics.concorrente_top1}` : 'Nenhum identificado'}
          tooltip="Quantidade de deals onde um concorrente foi identificado nas interacoes. Mostra o concorrente mais mencionado."
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Funnel */}
        <MagicCard className="border-slate-200/60 bg-white/60">
          <div className="p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500 font-display mb-4">
              Funil de Penetracao
            </p>
            <div className="space-y-2">
              {funnel.map((step, i) => (
                <FunnelBar key={step.label} step={step} index={i} maxValue={funnel[0]?.value || 1} />
              ))}
            </div>
          </div>
        </MagicCard>

        {/* Response Distribution */}
        <MagicCard className="border-slate-200/60 bg-white/60">
          <div className="p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500 font-display mb-4">
              Distribuicao de Respostas
            </p>
            {respostas.length > 0 ? (
              <div className="space-y-2">
                {respostas.map((r) => (
                  <RespostaBar key={r.label} label={r.label} count={r.count} maxCount={maxRespostaCount} />
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">Sem dados de respostas</p>
            )}
          </div>
        </MagicCard>
      </div>

      {/* Competitors Table */}
      {concorrentes.length > 0 && (
        <MagicCard className="border-slate-200/60 bg-white/60">
          <div className="p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500 font-display mb-3">
              Concorrentes Identificados
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-2 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Concorrente</th>
                    <th className="text-center py-2 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Deals</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Renovacao Proxima</th>
                  </tr>
                </thead>
                <tbody>
                  {concorrentes.map((c) => (
                    <tr key={c.nome} className="border-b border-slate-50 last:border-0">
                      <td className="py-2 px-3 font-medium text-slate-700">{c.nome}</td>
                      <td className="py-2 px-3 text-center">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-50 text-red-600 text-xs font-bold">
                          {c.deals}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-500">
                        {c.renovacao ? formatRenovacao(c.renovacao) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </MagicCard>
      )}
    </motion.div>
  );
};

function formatRenovacao(yyyyMm: string): string {
  const [year, month] = yyyyMm.split('-');
  if (!year || !month) return yyyyMm;
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const idx = parseInt(month, 10) - 1;
  return `${meses[idx] || month}/${year}`;
}
