import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { fetchFromSheets } from "@/lib/sheets";

// Cache em memória (por instância do servidor)
const memoryCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutos

// Mapear período do Dashboard para período da planilha
type PeriodoResult =
  | { custom: false; key: string }
  | { custom: true; key: string; dataInicio: string; dataFim: string };

function mapPeriodo(range: string): PeriodoResult {
  if (range.startsWith("custom:")) {
    const parts = range.split(":");
    const inicio = parts[1] ?? "";
    const fim = parts[2] ?? "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(inicio) && /^\d{4}-\d{2}-\d{2}$/.test(fim)) {
      // Pick best base period for activity metrics approximation
      const diffDays = Math.round(
        (new Date(fim).getTime() - new Date(inicio).getTime()) / 86_400_000
      );
      const base = diffDays <= 1 ? "hoje" : diffDays <= 7 ? "7d" : diffDays <= 15 ? "15d" : "30d";
      return { custom: true, key: base, dataInicio: inicio, dataFim: fim };
    }
  }
  if (range === "today") return { custom: false, key: "hoje" };
  if (range === "7d") return { custom: false, key: "7d" };
  if (range === "15d") return { custom: false, key: "15d" };
  if (range === "30d") return { custom: false, key: "30d" };
  if (range === "month") return { custom: false, key: "mes" };
  if (range === "alltime") return { custom: false, key: "alltime" };
  return { custom: false, key: "hoje" };
}

// Período de referência para comparação temporal
function getReferencePeriod(key: string): string | null {
  const map: Record<string, string> = {
    hoje: "7d",
    "7d": "30d",
    "15d": "30d",
    "30d": "mes",
  };
  return map[key] ?? null;
}

function getDaysInPeriod(key: string): number {
  const map: Record<string, number> = {
    hoje: 1,
    "7d": 7,
    "15d": 15,
    "30d": 30,
    mes: 30,
  };
  return map[key] ?? 30;
}

export async function GET(request: NextRequest) {
  // Verificar sessão
  const session = await verifySession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const periodo = searchParams.get("periodo") || "hoje";
  const periodoResult = mapPeriodo(periodo);

  // Verificar cache
  const cacheKey = periodoResult.custom
    ? `metricas_custom_${(periodoResult as any).dataInicio}_${(periodoResult as any).dataFim}`
    : `metricas_${periodoResult.key}`;
  const cached = memoryCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({
      ...cached.data,
      _cached: true,
      _cacheAge: Math.round((Date.now() - cached.timestamp) / 1000)
    });
  }

  try {
    // Buscar da aba "metricas"
    const metricas = await fetchFromSheets("metricas");

    // Buscar deals ativos e clientes fechados (needed for alltime + standard)
    const [dealsAtivos, clientesFechados] = await Promise.all([
      fetchFromSheets("deals_ativos"),
      fetchFromSheets("clientes_fechados")
    ]);

    // Filtrar pela linha do período solicitado (pegar a mais recente)
    const metricasPeriodo = metricas
      .filter((row: any) => row.periodo === periodoResult.key)
      .sort((a: any, b: any) =>
        new Date(b.data_coleta).getTime() - new Date(a.data_coleta).getTime()
      );

    const metrica = metricasPeriodo[0];

    if (!metrica) {
      return NextResponse.json(
        { error: "Dados não encontrados para o período", periodo: periodoResult.key },
        { status: 404 }
      );
    }

    // For custom ranges, recompute deal metrics from raw clientes_fechados
    let dealsFechadosCount = Number(metrica.deals_fechados) || 0;
    let valorFechado = Number(metrica.valor_fechado) || 0;
    let comissaoFechado = Number(metrica.comissao_fechado) || 0;
    let ticketMedio = Number(metrica.ticket_medio) || 0;
    let ultimoCliente: { nome: string; origem: string; valor: number; data: string } | null =
      metrica.ultimo_cliente_nome ? {
        nome: metrica.ultimo_cliente_nome,
        origem: metrica.ultimo_cliente_origem || "N/A",
        valor: Number(metrica.ultimo_cliente_valor) || 0,
        data: metrica.data_coleta
      } : null;
    let periodoLabel = metrica.periodo === "hoje" ? metrica.data_coleta :
                       metrica.periodo === "mes" ? "Este Mês" :
                       metrica.periodo === "alltime" ? "All Time" :
                       `Últimos ${metrica.periodo.replace("d", "")} dias`;

    if (periodoResult.custom) {
      const { dataInicio, dataFim } = periodoResult;

      // Filter clientes_fechados by custom date range
      const fechadosNoRange = (clientesFechados || []).filter((d: any) => {
        const date = String(d.data || "").slice(0, 10);
        return date >= dataInicio && date <= dataFim;
      });

      dealsFechadosCount = fechadosNoRange.length;
      valorFechado = fechadosNoRange.reduce((sum: number, d: any) => sum + (Number(d.valor) || 0), 0);
      comissaoFechado = fechadosNoRange.reduce((sum: number, d: any) => sum + (Number(d.comissao_valor) || 0), 0);
      ticketMedio = dealsFechadosCount > 0 ? Math.round(valorFechado / dealsFechadosCount) : 0;

      // Most recent closed deal in range
      const sorted = [...fechadosNoRange].sort((a: any, b: any) =>
        String(b.data || "").localeCompare(String(a.data || ""))
      );
      if (sorted.length > 0) {
        const last = sorted[0];
        ultimoCliente = {
          nome: last.nome || "N/A",
          origem: last.origem || "N/A",
          valor: Number(last.valor) || 0,
          data: String(last.data || "").slice(0, 10)
        };
      } else {
        ultimoCliente = null;
      }

      // Format period label as "dd/MM - dd/MM"
      const fmtDate = (iso: string) => {
        const [, m, d] = iso.split("-");
        return `${d}/${m}`;
      };
      periodoLabel = `${fmtDate(dataInicio)} - ${fmtDate(dataFim)}`;
    }

    // Buscar período de referência para comparação temporal
    let comparison: any = undefined;
    const refKey = getReferencePeriod(periodoResult.key);
    if (refKey && !periodoResult.custom) {
      const refRow = metricas
        .filter((row: any) => row.periodo === refKey)
        .sort((a: any, b: any) =>
          new Date(b.data_coleta).getTime() - new Date(a.data_coleta).getTime()
        )[0];

      if (refRow) {
        comparison = {
          periodo: refKey,
          dias: getDaysInPeriod(refKey),
          comissao_fechado: Number(refRow.comissao_fechado) || 0,
          deals_fechados: Number(refRow.deals_fechados) || 0,
          ligacoes: Number(refRow.ligacoes) || 0,
          emails: Number(refRow.emails) || 0,
          reunioes: Number(refRow.reunioes) || 0,
          taxa_conectividade: Number(refRow.taxa_conectividade) || 0,
          win_rate: Number(refRow.win_rate) || 0,
          ticket_medio: Number(refRow.ticket_medio) || 0,
          contatos_decisor: Number(refRow.contatos_decisor) || 0,
          contatos_decisor_info: Number(refRow.contatos_decisor_info) || 0,
        };
      }
    }

    // Montar resposta no formato esperado pelo Dashboard
    const response: any = {
      data: metrica.data_coleta,
      hora: new Date().toLocaleTimeString("pt-BR"),
      periodo: periodoLabel,
      ligacoes: Number(metrica.ligacoes) || 0,
      ligacoes_atendidas: Number(metrica.ligacoes_atendidas) || 0,
      taxa_conectividade: Number(metrica.taxa_conectividade) || 0,
      emails: Number(metrica.emails) || 0,
      reunioes: Number(metrica.reunioes) || 0,
      apresentacoes: Number(metrica.apresentacoes) || 0,
      propostas: Number(metrica.propostas) || 0,
      deals_novos: Number(metrica.deals_novos) || Number(metrica.deals_ativos) || 0,
      deals_fechados: dealsFechadosCount,
      valor_pipeline: Number(metrica.valor_pipeline) || 0,
      valor_fechado: valorFechado,
      comissao_pipeline: Number(metrica.comissao_pipeline) || 0,
      comissao_fechado: comissaoFechado,
      ticket_medio: ticketMedio,
      win_rate: Number(metrica.win_rate) || 0,
      contatos_decisor: Number(metrica.contatos_decisor) || 0,
      contatos_decisor_info: Number(metrica.contatos_decisor_info) || 0,
      deals_pipeline: Number(metrica.deals_pipeline) || 0,
      ultimo_cliente: ultimoCliente,
      parceiros: {
        total: 5,
        lista: ["SecuriSoft", "EXHTech", "AlphaNetworking", "Adriano", "Otavio"]
      },
      deals_ativos: dealsAtivos || [],
      clientes_fechados: clientesFechados || [],
      _source: "google_sheets",
    };

    if (comparison) {
      response._comparison = comparison;
    }

    // Salvar no cache
    memoryCache.set(cacheKey, {
      data: response,
      timestamp: Date.now()
    });

    return NextResponse.json(response);

  } catch (error) {
    console.error("Error in dashboard-sheets route:", error);
    return NextResponse.json(
      { error: "Erro ao buscar dados da planilha" },
      { status: 500 }
    );
  }
}
