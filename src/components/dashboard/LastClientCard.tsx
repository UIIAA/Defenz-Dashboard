"use client";

import { Target } from 'lucide-react';
import { MagicCard } from '@/components/ui/MagicCard';
import { Tooltip } from '@/components/ui/Tooltip';
import { formatCurrency, normalizeDate } from '@/lib/formatters';
import type { Client } from '@/lib/types';

interface LastClientCardProps {
  client: Client | undefined;
  loading?: boolean;
}

function formatDateBR(dateStr: string | undefined): string {
  const normalized = normalizeDate(dateStr);
  if (!normalized) return '';
  const [y, m, d] = normalized.split('-');
  return `${d}/${m}/${y}`;
}

function buildClientTooltip(client: Client | undefined): string | null {
  if (!client) return null;
  const lines: string[] = [];
  const closedDate = formatDateBR(client.data);
  if (closedDate) lines.push(`Fechado em ${closedDate}`);
  if (client.origem) lines.push(`Origem: ${client.origem}`);
  return lines.length > 0 ? lines.join('\n') : null;
}

export const LastClientCard = ({ client, loading }: LastClientCardProps) => {
  const tooltipText = buildClientTooltip(client);

  return (
    <MagicCard className="p-6 bg-gradient-to-br from-red-50 to-transparent">
      <h3 className="text-xs font-bold text-red-600 mb-2 uppercase tracking-widest font-display flex items-center gap-2">
        <Target size={14} /> Ultimo Fechamento
      </h3>
      {loading ? (
        <div className="h-12 bg-slate-100 rounded w-full animate-pulse" />
      ) : tooltipText ? (
        <Tooltip content={<span className="whitespace-pre-line">{tooltipText}</span>}>
          <div className="cursor-help">
            <p className="text-2xl font-display font-medium text-slate-900 leading-snug">{client?.nome}</p>
            <div className="mt-4 flex justify-between items-end border-t border-red-100 pt-4">
              <div>
                <p className="text-xs text-slate-500 uppercase mb-0.5">Origem</p>
                <p className="text-sm text-slate-700 font-medium">{client?.origem}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500 uppercase mb-0.5">Valor</p>
                <p className="text-red-600 text-lg font-mono font-bold">{formatCurrency(client?.valor || 0)}</p>
              </div>
            </div>
          </div>
        </Tooltip>
      ) : (
        <div>
          <p className="text-2xl font-display font-medium text-slate-900 leading-snug">{client?.nome}</p>
          <div className="mt-4 flex justify-between items-end border-t border-red-100 pt-4">
            <div>
              <p className="text-xs text-slate-500 uppercase mb-0.5">Origem</p>
              <p className="text-sm text-slate-700 font-medium">{client?.origem}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500 uppercase mb-0.5">Valor</p>
              <p className="text-red-600 text-lg font-mono font-bold">{formatCurrency(client?.valor || 0)}</p>
            </div>
          </div>
        </div>
      )}
    </MagicCard>
  );
};
