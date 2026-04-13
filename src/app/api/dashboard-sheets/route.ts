import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { fetchFromSheets } from "@/lib/sheets";
import { computeMetrics, getLastClosedClient, isPipeline, isClosedWon } from "@/lib/metrics";
import type { RawDeal, RawCall, RawEmail, RawClassificacao } from "@/lib/types";

// Cache em memória (por instância do servidor)
const memoryCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutos

// Compute date range from period key
function getDateRange(periodo: string): { start: string; end: string; label: string } {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  const todayStr = fmt(today);

  switch (periodo) {
    case 'today': {
      return { start: todayStr, end: todayStr, label: todayStr };
    }
    case '7d': {
      const start = new Date(today);
      start.setDate(start.getDate() - 7);
      return { start: fmt(start), end: todayStr, label: 'Últimos 7 dias' };
    }
    case '15d': {
      const start = new Date(today);
      start.setDate(start.getDate() - 15);
      return { start: fmt(start), end: todayStr, label: 'Últimos 15 dias' };
    }
    case '30d': {
      const start = new Date(today);
      start.setDate(start.getDate() - 30);
      return { start: fmt(start), end: todayStr, label: 'Últimos 30 dias' };
    }
    case 'month': {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start: fmt(start), end: todayStr, label: 'Este Mês' };
    }
    case 'alltime': {
      return { start: '2020-01-01', end: todayStr, label: 'All Time' };
    }
    default: {
      // Custom range: "custom:YYYY-MM-DD:YYYY-MM-DD"
      if (periodo.startsWith('custom:')) {
        const parts = periodo.split(':');
        const inicio = parts[1] ?? '';
        const fim = parts[2] ?? '';
        if (/^\d{4}-\d{2}-\d{2}$/.test(inicio) && /^\d{4}-\d{2}-\d{2}$/.test(fim)) {
          const fmtDate = (iso: string) => {
            const [, m, d] = iso.split('-');
            return `${d}/${m}`;
          };
          return { start: inicio, end: fim, label: `${fmtDate(inicio)} - ${fmtDate(fim)}` };
        }
      }
      return { start: todayStr, end: todayStr, label: todayStr };
    }
  }
}

// Período de referência para comparação temporal
function getReferencePeriod(periodo: string): string | null {
  const map: Record<string, string> = {
    today: '7d',
    '7d': '30d',
    '15d': '30d',
    '30d': 'alltime',
  };
  return map[periodo] ?? null;
}

export async function GET(request: NextRequest) {
  const session = await verifySession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const periodo = searchParams.get("periodo") || "today";

  // Verificar cache
  const cacheKey = `metrics_v5_${periodo}`;
  const cached = memoryCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({
      ...cached.data,
      _cached: true,
      _cacheAge: Math.round((Date.now() - cached.timestamp) / 1000)
    });
  }

  try {
    // Fetch raw data from 4 tabs in parallel
    const [deals, calls, emails, classificacoes] = await Promise.all([
      fetchFromSheets("deals") as Promise<RawDeal[]>,
      fetchFromSheets("ligacoes") as Promise<RawCall[]>,
      fetchFromSheets("emails") as Promise<RawEmail[]>,
      fetchFromSheets("classificacao_ia") as Promise<RawClassificacao[]>,
    ]);

    const dateRange = getDateRange(periodo);
    const metrics = computeMetrics(deals, calls, emails, classificacoes, dateRange);

    // Get last closed client
    const ultimoCliente = getLastClosedClient(deals, dateRange);

    // Separate deals for frontend
    const dealsAtivos = deals
      .filter(d => !isClosedWon(String(d.stage || '')) && isPipeline(String(d.stage || '')))
      .map(d => ({
        id: String(d.id || ''),
        id_data: String(d.id || ''),
        nome: String(d.nome || ''),
        empresa: (String(d.empresa || '').trim().length > 0) ? String(d.empresa || '') : '-',
        stage: String(d.stage || ''),
        valor: Number(d.valor) || 0,
        origem: String(d.lead_source || ''),
        categoria: String(d.categoria || ''),
        comissao_valor: Number(d.comissao_valor) || 0,
        data: String(d.created_time || '').slice(0, 10),
        modified_time: String(d.modified_time || ''),
      }));

    const clientesFechados = deals
      .filter(d => isClosedWon(String(d.stage || '')))
      .map(d => ({
        id: String(d.id || ''),
        id_data: String(d.id || ''),
        nome: String(d.nome || ''),
        empresa: (String(d.empresa || '').trim().length > 0) ? String(d.empresa || '') : '-',
        stage: String(d.stage || ''),
        valor: Number(d.valor) || 0,
        origem: String(d.lead_source || ''),
        categoria: String(d.categoria || ''),
        comissao_valor: Number(d.comissao_valor) || 0,
        data: String(d.modified_time || '').slice(0, 10),
        modified_time: String(d.modified_time || ''),
      }));

    // Build comparison data
    let comparison: any = undefined;
    const refPeriod = getReferencePeriod(periodo);
    if (refPeriod && !periodo.startsWith('custom:')) {
      const refRange = getDateRange(refPeriod);
      const refMetrics = computeMetrics(deals, calls, emails, classificacoes, refRange);
      const diffDays = Math.round(
        (new Date(refRange.end).getTime() - new Date(refRange.start).getTime()) / 86400000
      ) || 1;
      comparison = {
        periodo: refPeriod,
        dias: diffDays,
        comissao_fechado: refMetrics.comissao_fechado,
        deals_fechados: refMetrics.deals_fechados,
        ligacoes: refMetrics.ligacoes,
        emails: refMetrics.emails,
        reunioes: refMetrics.reunioes,
        taxa_conectividade: refMetrics.taxa_conectividade,
        win_rate: refMetrics.win_rate,
        ticket_medio: refMetrics.ticket_medio,
        contatos_decisor: refMetrics.contatos_decisor,
        contatos_decisor_info: refMetrics.contatos_decisor_info,
      };
    }

    // Montar resposta no formato esperado pelo Dashboard (N8nData shape)
    const response: any = {
      data: new Date().toISOString().split('T')[0],
      hora: new Date().toLocaleTimeString("pt-BR"),
      periodo: dateRange.label,
      ligacoes: metrics.ligacoes,
      ligacoes_atendidas: metrics.ligacoes_atendidas,
      taxa_conectividade: metrics.taxa_conectividade,
      emails: metrics.emails,
      reunioes: metrics.reunioes,
      apresentacoes: metrics.apresentacoes,
      propostas: metrics.propostas,
      deals_novos: metrics.deals_novos,
      deals_fechados: metrics.deals_fechados,
      valor_pipeline: metrics.valor_pipeline,
      valor_fechado: metrics.valor_fechado,
      comissao_pipeline: metrics.comissao_pipeline,
      comissao_fechado: metrics.comissao_fechado,
      ticket_medio: metrics.ticket_medio,
      win_rate: metrics.win_rate,
      contatos_decisor: metrics.contatos_decisor,
      contatos_decisor_info: metrics.contatos_decisor_info,
      deals_pipeline: metrics.deals_pipeline,
      ultimo_cliente: ultimoCliente,
      parceiros: {
        total: 5,
        lista: ["SecuriSoft", "EXHTech", "AlphaNetworking", "Adriano", "Otavio"]
      },
      deals_ativos: dealsAtivos,
      clientes_fechados: clientesFechados,
      _source: "google_sheets",
    };

    if (comparison) {
      response._comparison = comparison;
    }

    // Salvar no cache
    memoryCache.set(cacheKey, { data: response, timestamp: Date.now() });

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error in dashboard-sheets route:", error);
    return NextResponse.json(
      { error: "Erro ao buscar dados da planilha" },
      { status: 500 }
    );
  }
}
