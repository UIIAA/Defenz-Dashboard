"use client";

import { Calendar, AlertCircle, Clock, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { MagicCard } from '@/components/ui/MagicCard';
import { StatCard } from '@/components/dashboard/StatCard';
import type { AgendaData } from '@/lib/types';

interface AgendaSectionProps {
  data: AgendaData;
  loading: boolean;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  const [year, month, day] = dateStr.split('-');
  if (!year || !month || !day) return dateStr;
  return `${day}/${month}`;
}

export const AgendaSection = ({ data, loading }: AgendaSectionProps) => {
  const { items, total, overdue, upcoming_7d } = data;

  if (loading) {
    return (
      <MagicCard className="border-slate-200/60 bg-white/60">
        <div className="p-6 flex items-center justify-center h-48">
          <Loader2 size={24} className="animate-spin text-slate-300" />
        </div>
      </MagicCard>
    );
  }

  if (total === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-4"
    >
      {/* Section title */}
      <div className="flex items-center gap-2">
        <Calendar size={16} className="text-red-500" />
        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 font-display">
          Agenda de Prospeccao
        </h2>
        <span className="text-xs text-slate-400">
          ({total} tarefas abertas)
        </span>
      </div>

      {/* 3 Stat Cards */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          loading={loading}
          icon={Calendar}
          title="Total Tarefas"
          value={String(total)}
          subtext="tarefas de follow-up"
          tooltip="Total de tarefas abertas no Zoho CRM vinculadas a leads."
        />
        <StatCard
          loading={loading}
          icon={AlertCircle}
          title="Atrasadas"
          value={String(overdue)}
          subtext={overdue > 0 ? 'requerem atencao' : 'nenhuma atrasada'}
          highlight={overdue > 0}
          tooltip="Tarefas com data de vencimento anterior a hoje."
        />
        <StatCard
          loading={loading}
          icon={Clock}
          title="Proximos 7 Dias"
          value={String(upcoming_7d)}
          subtext="tarefas agendadas"
          tooltip="Tarefas com vencimento nos proximos 7 dias."
        />
      </div>

      {/* Tasks Table */}
      <MagicCard className="border-slate-200/60 bg-white/60">
        <div className="p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 font-display mb-3">
            Tarefas Pendentes
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Lead</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Empresa</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Tarefa</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Data</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {items.slice(0, 20).map((item) => (
                  <tr
                    key={item.task_id}
                    className={`border-b border-slate-50 last:border-0 ${item.is_overdue ? 'bg-red-50/50' : ''}`}
                  >
                    <td className="py-2 px-3 font-medium text-slate-700 max-w-[180px] truncate">
                      {item.lead_name}
                    </td>
                    <td className="py-2 px-3 text-slate-500 max-w-[140px] truncate">{item.empresa}</td>
                    <td className="py-2 px-3 text-slate-600 max-w-[200px] truncate">{item.subject}</td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <span className={item.is_overdue ? 'text-red-600 font-semibold' : 'text-slate-500'}>
                        {formatDate(item.due_date)}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        item.is_overdue
                          ? 'bg-red-100 text-red-600'
                          : 'bg-slate-100 text-slate-500'
                      }`}>
                        {item.is_overdue ? 'Atrasada' : item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {items.length > 20 && (
            <p className="text-xs text-slate-400 mt-2 text-center">
              Mostrando 20 de {items.length} tarefas
            </p>
          )}
        </div>
      </MagicCard>
    </motion.div>
  );
};
