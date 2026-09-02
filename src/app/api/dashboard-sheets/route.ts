import { NextRequest, NextResponse } from "next/server";
import { CACHE_TTL_MS } from "@/lib/cache-ttl";
import { verifySession } from "@/lib/auth";
import { fetchFromSheets, fetchTabStrict } from "@/lib/sheets";
import { computeMetrics, getLastClosedClient, isClosedWon, bucketizeByWeek, computeClientesAtivos, computeRenovacoesVencidas, computePipelineBuckets, computeFaturamentoMensal, computeMrrArr, computeComissaoOwnerCanal, computeReceitaPorCanal } from "@/lib/metrics";
import { getDateRange } from "@/lib/periodo";
import { hojeBRT } from "@/lib/brt";
import { isAberto } from "@/lib/pipe";
import type { RawDeal, RawCall, RawEmail, RawClassificacao, RawReuniao, RawLead } from "@/lib/types";

type EmpresaSource = 'deal' | 'nome-derived' | 'leads-tab' | 'unknown';

function resolveEmpresa(
  deal: RawDeal,
  leadsByNome: Map<string, string>
): { empresa: string; empresa_source: EmpresaSource } {
  // 1. Use deal.empresa if valid
  const dealEmpresa = String(deal.empresa || '').trim();
  if (dealEmpresa && dealEmpresa !== '-') {
    return { empresa: dealEmpresa, empresa_source: 'deal' };
  }

  // 2. Derive from deal.nome — format "Empresa - Contato" → take first segment
  const dealNome = String(deal.nome || '').trim();
  const parts = dealNome.split(' - ');
  if (parts.length >= 2 && parts[0].trim()) {
    return { empresa: parts[0].trim(), empresa_source: 'nome-derived' };
  }

  // 3. Look up contact name in leads tab
  //    When nome has no ' - ', treat the full nome as the contact key
  const contactKey = parts.length >= 2
    ? parts.slice(1).join(' - ').trim()
    : dealNome;
  if (contactKey) {
    const fromLead = leadsByNome.get(contactKey.toLowerCase());
    if (fromLead) {
      return { empresa: fromLead, empresa_source: 'leads-tab' };
    }
  }

  // 4. Nothing found
  return { empresa: '(sem empresa)', empresa_source: 'unknown' };
}

// Cache em memória (por instância do servidor)
const memoryCache = new Map<string, { data: any; timestamp: number }>();


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
    // Fetch raw data from required tabs + optional reunioes tab in parallel
    const [deals, calls, emails, classificacoes, reunioesRaw, leads] = await Promise.all([
      fetchFromSheets("deals") as Promise<RawDeal[]>,
      fetchFromSheets("ligacoes") as Promise<RawCall[]>,
      fetchFromSheets("emails") as Promise<RawEmail[]>,
      fetchFromSheets("classificacao_ia") as Promise<RawClassificacao[]>,
      // Strict: gviz returns sheet 0 (ligacoes) for a non-existent 'reunioes' tab.
      // 'assunto' is unique to the reunioes schema, so this returns null (→ resultados
      // proxy fallback) instead of mis-reading ligacoes rows as meetings.
      fetchTabStrict("reunioes", ["data", "assunto"]) as Promise<RawReuniao[] | null>,
      fetchFromSheets("leads") as Promise<RawLead[]>,
    ]);

    // Build leads lookup: lead.nome (contact) → lead.empresa
    const leadsByNome = new Map<string, string>();
    for (const lead of leads) {
      const nome = String(lead.nome || '').trim();
      const emp = String(lead.empresa || '').trim();
      if (nome && emp && emp !== '-') {
        leadsByNome.set(nome.toLowerCase(), emp);
      }
    }

    const hoje = hojeBRT();
    const dateRange = getDateRange(periodo, hoje);
    const metrics = computeMetrics(deals, calls, emails, classificacoes, dateRange, reunioesRaw);
    const weeklyBuckets = bucketizeByWeek(deals, calls, emails, dateRange, reunioesRaw);
    const clientesAtivos = computeClientesAtivos(deals);
    const renovacoesVencidas = computeRenovacoesVencidas(deals);
    const pipelineBuckets = computePipelineBuckets(deals);
    const faturamentoMensal = computeFaturamentoMensal(deals);
    const mrrArr = computeMrrArr(deals);
    const comissaoOwnerCanal = computeComissaoOwnerCanal(deals);
    const receitaPorCanal = computeReceitaPorCanal(deals, dateRange);

    // Get last closed client
    const ultimoCliente = getLastClosedClient(deals, dateRange);

    // Separate deals for frontend
    const dealsAtivos = deals
      .filter(d => isAberto(String(d.stage || '')))
      .map(d => {
        const { empresa, empresa_source } = resolveEmpresa(d, leadsByNome);
        return {
          id: String(d.id || ''),
          id_data: String(d.id || ''),
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
      .filter(d => isClosedWon(String(d.stage || '')))
      .map(d => {
        const { empresa, empresa_source } = resolveEmpresa(d, leadsByNome);
        return {
          id: String(d.id || ''),
          id_data: String(d.id || ''),
          nome: String(d.nome || ''),
          empresa,
          empresa_source,
          stage: String(d.stage || ''),
          valor: Number(d.valor) || 0,
          origem: String(d.lead_source || ''),
          categoria: String(d.categoria || ''),
          comissao_valor: Number(d.comissao_valor) || 0,
          data: String(d.modified_time || '').slice(0, 10),
          modified_time: String(d.modified_time || ''),
        };
      });

    // Build comparison data
    let comparison: any = undefined;
    const refPeriod = getReferencePeriod(periodo);
    if (refPeriod && !periodo.startsWith('custom:')) {
      const refRange = getDateRange(refPeriod, hoje);
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
      total_licencas_ativas: metrics.total_licencas_ativas,
      ultimo_cliente: ultimoCliente,
      parceiros: {
        total: 5,
        lista: ["SecuriSoft", "EXHTech", "AlphaNetworking", "Adriano", "Otavio"]
      },
      deals_ativos: dealsAtivos,
      clientes_fechados: clientesFechados,
      _source: "google_sheets",
      _coverage: metrics.coverage,
      _weekly_buckets: weeklyBuckets,
      _clientes_ativos: clientesAtivos,
      _renovacoes_vencidas: renovacoesVencidas,
      _pipeline_buckets: pipelineBuckets,
      _faturamento_mensal: faturamentoMensal,
      _mrr_arr: mrrArr,
      _comissao_owner_canal: comissaoOwnerCanal,
      _receita_por_canal: receitaPorCanal,
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
