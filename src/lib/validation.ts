import type { N8nData } from './types';
import { str } from './formatters';

export const validateN8nData = (raw: any): N8nData => {
  const num = (v: any, fallback = 0) => {
    const n = Number(v);
    return isNaN(n) ? fallback : n;
  };

  return {
    data: str(raw.data, new Date().toISOString().split('T')[0], 10),
    hora: str(raw.hora, '--:--', 12),
    periodo: str(raw.periodo, '', 100),
    ligacoes: Math.max(0, num(raw.ligacoes)),
    ligacoes_atendidas: Math.max(0, num(raw.ligacoes_atendidas)),
    taxa_conectividade: Math.min(100, Math.max(0, num(raw.taxa_conectividade))),
    emails: Math.max(0, num(raw.emails)),
    reunioes: Math.max(0, num(raw.reunioes)),
    apresentacoes: Math.max(0, num(raw.apresentacoes)),
    propostas: Math.max(0, num(raw.propostas)),
    deals_novos: Math.max(0, num(raw.deals_novos)),
    deals_fechados: Math.max(0, num(raw.deals_fechados)),
    valor_pipeline: Math.max(0, num(raw.valor_pipeline)),
    valor_fechado: Math.max(0, num(raw.valor_fechado)),
    comissao_pipeline: Math.max(0, num(raw.comissao_pipeline)),
    comissao_fechado: Math.max(0, num(raw.comissao_fechado)),
    ticket_medio: Math.max(0, num(raw.ticket_medio)),
    win_rate: Math.min(100, Math.max(0, num(raw.win_rate))),
    ultimo_cliente: {
      nome: str(raw.ultimo_cliente?.nome, 'N/A'),
      origem: str(raw.ultimo_cliente?.origem, 'N/A'),
      valor: num(raw.ultimo_cliente?.valor),
      data: str(raw.ultimo_cliente?.data, '', 10),
    },
    parceiros: {
      total: num(raw.parceiros?.total),
      lista: Array.isArray(raw.parceiros?.lista)
        ? raw.parceiros.lista.slice(0, 100).map((p: any) => str(p, '', 100))
        : [],
    },
    deals_ativos: Array.isArray(raw.deals_ativos)
      ? raw.deals_ativos.slice(0, 500)
      : [],
    clientes_fechados: Array.isArray(raw.clientes_fechados)
      ? raw.clientes_fechados.slice(0, 500)
      : [],
  };
};

export const checkConsistency = (d: N8nData): string[] => {
  const warnings: string[] = [];

  if (d.deals_ativos.length > 0 && d.deals_novos > 0 && d.deals_novos !== d.deals_ativos.length) {
    warnings.push('Divergência entre deals_novos e lista de deals ativos');
  }

  if (d.parceiros.total !== d.parceiros.lista.length) {
    warnings.push('Divergência entre total de parceiros e lista');
  }

  if (d.ligacoes > 0) {
    const taxaCalculada = Math.round((d.ligacoes_atendidas / d.ligacoes) * 100);
    if (Math.abs(d.taxa_conectividade - taxaCalculada) > 2) {
      warnings.push('Divergência na taxa de conectividade');
    }
  }

  return warnings;
};
