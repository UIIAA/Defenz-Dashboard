import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { fetchFromSheets, fetchTabStrict } from "@/lib/sheets";
import {
  computeMetrics,
  getLastClosedClient,
  isPipeline,
  isClosedWon,
  bucketizeByWeek,
  computeClientesAtivos,
  computeRenovacoesVencidas,
  computeEsforcoDiario,
} from "@/lib/metrics";
import type {
  RawDeal,
  RawCall,
  RawEmail,
  RawClassificacao,
  RawReuniao,
  RawLead,
  DailyCallPoint,
} from "@/lib/types";

// Cache em memória (por instância do servidor)
const memoryCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutos

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTHS_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

type EmpresaSource = 'deal' | 'nome-derived' | 'leads-tab' | 'unknown';

function resolveEmpresa(
  deal: RawDeal,
  leadsByNome: Map<string, string>
): { empresa: string; empresa_source: EmpresaSource } {
  const dealEmpresa = String(deal.empresa || '').trim();
  if (dealEmpresa && dealEmpresa !== '-') {
    return { empresa: dealEmpresa, empresa_source: 'deal' };
  }

  const dealNome = String(deal.nome || '').trim();
  const parts = dealNome.split(' - ');
  if (parts.length >= 2 && parts[0].trim()) {
    return { empresa: parts[0].trim(), empresa_source: 'nome-derived' };
  }

  const contactKey = parts.length >= 2
    ? parts.slice(1).join(' - ').trim()
    : dealNome;
  if (contactKey) {
    const fromLead = leadsByNome.get(contactKey.toLowerCase());
    if (fromLead) {
      return { empresa: fromLead, empresa_source: 'leads-tab' };
    }
  }

  return { empresa: '(sem empresa)', empresa_source: 'unknown' };
}

function buildDailyCallSeries(calls: RawCall[], start: string, end: string): DailyCallPoint[] {
  const dayMap = new Map<string, { total: number; atendidas: number }>();

  for (const call of calls) {
    const d = String(call.data || '').slice(0, 10);
    if (!DATE_RE.test(d) || d < start || d > end) continue;

    const entry = dayMap.get(d) ?? { total: 0, atendidas: 0 };
    entry.total++;
    if (String(call.status || '').toLowerCase() === 'atendida') {
      entry.atendidas++;
    }
    dayMap.set(d, entry);
  }

  return Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([data, { total, atendidas }]) => ({
      data,
      total,
      atendidas,
      taxa: total > 0 ? Math.round((atendidas / total) * 100) : 0,
    }));
}

export async function GET(request: NextRequest) {
  const session = await verifySession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const anoStr = searchParams.get("ano");
  const mesStr = searchParams.get("mes");

  if (!anoStr || !mesStr) {
    return NextResponse.json(
      { error: "Parâmetros obrigatórios: ano e mes" },
      { status: 400 }
    );
  }

  const ano = parseInt(anoStr, 10);
  const mes = parseInt(mesStr, 10);

  if (isNaN(ano) || isNaN(mes) || mes < 1 || mes > 12 || ano < 2020 || ano > 2100) {
    return NextResponse.json(
      { error: "ano deve ser >= 2020 e mes deve ser entre 1 e 12" },
      { status: 400 }
    );
  }

  const mesFormatted = String(mes).padStart(2, '0');
  const start = `${ano}-${mesFormatted}-01`;
  const lastDay = new Date(ano, mes, 0).getDate(); // day 0 of next month = last day of current
  const end = `${ano}-${mesFormatted}-${String(lastDay).padStart(2, '0')}`;
  const label = `${MONTHS_PT[mes - 1]} ${ano}`;
  const dateRange = { start, end, label };

  const cacheKey = `relatorio_mensal_${ano}_${mes}`;
  const cached = memoryCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({
      ...cached.data,
      _cached: true,
      _cacheAge: Math.round((Date.now() - cached.timestamp) / 1000),
    });
  }

  try {
    const [deals, calls, emails, classificacoes, reunioesRaw, leads] = await Promise.all([
      fetchFromSheets("deals") as Promise<RawDeal[]>,
      fetchFromSheets("ligacoes") as Promise<RawCall[]>,
      fetchFromSheets("emails") as Promise<RawEmail[]>,
      fetchFromSheets("classificacao_ia") as Promise<RawClassificacao[]>,
      // 'assunto' é exclusivo do schema de reunioes. Sem o strict, a aba (que ainda
      // NÃO existe) caía no fallback silencioso do gviz para a sheet 0 = `ligacoes`,
      // e as ~11,5k ligações entravam em computeMetrics/bucketizeByWeek COMO REUNIÕES.
      // Mesmo tratamento já usado em /api/dashboard-sheets → null cai no proxy [REUNIAO].
      fetchTabStrict("reunioes", ["data", "assunto"]) as Promise<RawReuniao[] | null>,
      fetchFromSheets("leads") as Promise<RawLead[]>,
    ]);

    // Build leads lookup: contact name → empresa
    const leadsByNome = new Map<string, string>();
    for (const lead of leads) {
      const nome = String(lead.nome || '').trim();
      const emp = String(lead.empresa || '').trim();
      if (nome && emp && emp !== '-') {
        leadsByNome.set(nome.toLowerCase(), emp);
      }
    }

    const metrics = computeMetrics(deals, calls, emails, classificacoes, dateRange, reunioesRaw);
    const weeklyBuckets = bucketizeByWeek(deals, calls, emails, dateRange, reunioesRaw);
    const clientesAtivos = computeClientesAtivos(deals);
    const renovacoesVencidas = computeRenovacoesVencidas(deals);
    const ultimoCliente = getLastClosedClient(deals, dateRange);
    const esforcoDiario = computeEsforcoDiario(calls, emails, dateRange);
    const dailyCallsSerie = buildDailyCallSeries(calls, start, end);

    const dealsAtivos = deals
      .filter(d => !isClosedWon(String(d.stage || '')) && isPipeline(String(d.stage || '')))
      .map(d => {
        const { empresa, empresa_source } = resolveEmpresa(d, leadsByNome);
        return {
          id: String(d.id || ''),
          nome: String(d.nome || ''),
          empresa,
          empresa_source,
          stage: String(d.stage || ''),
          valor: Number(d.valor) || 0,
          origem: String(d.lead_source || ''),
          categoria: String(d.categoria || ''),
          comissao_valor: Number(d.comissao_valor) || 0,
          data: String(d.created_time || '').slice(0, 10),
          modified_time: String(d.modified_time || ''),
        };
      });

    const clientesFechados = deals
      .filter(d => {
        if (!isClosedWon(String(d.stage || ''))) return false;
        const closingDate = String(d.closing_date || d.modified_time || '').slice(0, 10);
        return closingDate >= start && closingDate <= end;
      })
      .map(d => {
        const { empresa, empresa_source } = resolveEmpresa(d, leadsByNome);
        return {
          id: String(d.id || ''),
          nome: String(d.nome || ''),
          empresa,
          empresa_source,
          stage: String(d.stage || ''),
          valor: Number(d.valor) || 0,
          origem: String(d.lead_source || ''),
          categoria: String(d.categoria || ''),
          comissao_valor: Number(d.comissao_valor) || 0,
          data: String(d.closing_date || d.modified_time || '').slice(0, 10),
        };
      });

    const response: any = {
      ano,
      mes,
      mes_label: label,
      date_range: dateRange,

      metrics: {
        ligacoes: metrics.ligacoes,
        ligacoes_atendidas: metrics.ligacoes_atendidas,
        taxa_conectividade: metrics.taxa_conectividade,
        emails: metrics.emails,
        reunioes: metrics.reunioes,
        apresentacoes: metrics.apresentacoes,
        propostas: metrics.propostas,
        deals_novos: metrics.deals_novos,
        deals_fechados: metrics.deals_fechados,
        deals_pipeline: metrics.deals_pipeline,
        valor_pipeline: metrics.valor_pipeline,
        valor_fechado: metrics.valor_fechado,
        comissao_pipeline: metrics.comissao_pipeline,
        comissao_fechado: metrics.comissao_fechado,
        ticket_medio: metrics.ticket_medio,
        win_rate: metrics.win_rate,
        contatos_decisor: metrics.contatos_decisor,
        contatos_decisor_info: metrics.contatos_decisor_info,
        total_licencas_ativas: metrics.total_licencas_ativas,
      },

      weekly_buckets: weeklyBuckets,
      daily_calls_serie: dailyCallsSerie,
      esforco_diario: esforcoDiario,

      deals_ativos: dealsAtivos,
      clientes_fechados: clientesFechados,
      ultimo_cliente: ultimoCliente,

      clientes_ativos: clientesAtivos,
      renovacoes_vencidas: renovacoesVencidas,

      coverage: metrics.coverage,
      _source: "google_sheets",
    };

    memoryCache.set(cacheKey, { data: response, timestamp: Date.now() });

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error in relatorio-mensal route:", error);
    return NextResponse.json(
      { error: "Erro ao gerar relatório mensal" },
      { status: 500 }
    );
  }
}
