import type { N8nData } from './types';

export const generateMockData = (range: string): N8nData => {
  let days: number;
  if (range.startsWith('custom:')) {
    const parts = range.split(':');
    const start = new Date(parts[1]);
    const end = new Date(parts[2]);
    days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000));
  } else if (range === 'today') {
    days = 1;
  } else if (range === 'month') {
    days = new Date().getDate();
  } else {
    days = parseInt(range.replace('d', ''), 10) || 7;
  }
  const multiplier = days / 7;

  const dealsFechados = Math.floor(2 * multiplier);

  return {
    data: new Date().toISOString().split('T')[0],
    hora: new Date().toLocaleTimeString(),
    periodo: range === '7d' ? 'Últimos 7 dias' : range === 'month' ? 'Este Mês' : `Últimos ${range.replace('d', '')} dias`,
    ligacoes: Math.floor(150 * multiplier),
    ligacoes_atendidas: Math.floor(53 * multiplier),
    taxa_conectividade: 35,
    emails: Math.floor(155 * multiplier),
    reunioes: Math.floor(10 * multiplier),
    apresentacoes: Math.floor(5 * multiplier),
    propostas: Math.floor(3 * multiplier),
    deals_novos: Math.floor(31 * multiplier),
    deals_fechados: dealsFechados,
    valor_pipeline: 210551.69 * multiplier,
    valor_fechado: 14617.40 * multiplier,
    comissao_pipeline: 52637.92 * multiplier,
    comissao_fechado: 730.87 * multiplier,
    ticket_medio: 32000,
    win_rate: dealsFechados > 0 ? 40 : 0,
    ultimo_cliente: {
      nome: "Zztech Informatica LTDA",
      origem: "Parceiro SS (SecuriSoft)",
      valor: 1223.65,
      data: "2026-01-26"
    },
    parceiros: {
      total: 5,
      lista: ["SecuriSoft", "EXHTech", "AlphaNetworking", "Adriano", "Otavio"]
    },
    deals_ativos: [
      { id: "1", data: "2026-01-26", nome: "Consube Agropecuária", origem: "Linkedin Ads", stage: "Contato inicial", valor: 0, categoria: "direto", comissao_valor: 0 },
      { id: "2", data: "2026-01-26", nome: "Brago Atacadista", origem: "Parceiro SS (SecuriSoft)", stage: "Em negociação", valor: 0, categoria: "securisoft", comissao_valor: 0 },
      { id: "3", data: "2026-01-26", nome: "FDC - Fundação Dom Cabral", origem: "Parceiro SS (SecuriSoft)", stage: "Contato inicial", valor: 57103.55, categoria: "securisoft", comissao_valor: 2855.18 },
      { id: "4", data: "2026-01-26", nome: "Plena Contabilidade", origem: "Apollo", stage: "Em negociação", valor: 13052.24, categoria: "direto", comissao_valor: 7570.30 },
      { id: "5", data: "2026-01-26", nome: "Allied Brasil", origem: "Parceiro SS (SecuriSoft)", stage: "Em negociação", valor: 56310.00, categoria: "securisoft", comissao_valor: 2815.50 },
    ],
    clientes_fechados: [
      { id: "101", data: "2026-01-26", nome: "Zztech Informatica LTDA", origem: "Parceiro SS (SecuriSoft)", valor: 1223.65, categoria: "securisoft", comissao_valor: 61.18 },
      { id: "102", data: "2026-01-23", nome: "ESTÂNCIA SUPERMERCADOS", origem: "Parceiro SS (SecuriSoft)", valor: 14617.40, categoria: "securisoft", comissao_valor: 730.87 },
      { id: "103", data: "2026-01-16", nome: "SEA TELECOM", origem: "Parceiro SS (SecuriSoft)", valor: 35467.50, categoria: "securisoft", comissao_valor: 1773.38 },
    ]
  };
};
