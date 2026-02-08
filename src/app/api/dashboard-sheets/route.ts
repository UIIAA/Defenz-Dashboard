import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";

// Cache em memória (por instância do servidor)
// Em produção, usar Redis/Upstash para cache persistente
const memoryCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutos

// ID da planilha do Google Sheets
const SPREADSHEET_ID = "1U6ley8bTw6SuVqoxLJDlVUFCkkYSAVPz9AZm6AU40p4";

// Função para ler do Google Sheets (planilha pública como CSV)
async function fetchFromSheets(sheetName: string): Promise<any[]> {
  // URL de exportação CSV do Google Sheets
  // Nota: A planilha precisa ser pública para leitura
  const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&headers=1&sheet=${encodeURIComponent(sheetName)}`;

  try {
    const response = await fetch(url, { next: { revalidate: 1800 } }); // Cache de 30min no Next.js

    if (!response.ok) {
      console.error(`Sheets fetch failed: ${response.status}`);
      return [];
    }

    const text = await response.text();

    // O Google retorna um JSON com prefixo que precisa ser removido
    const jsonMatch = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?$/);
    if (!jsonMatch) {
      console.error("Could not parse Sheets response");
      return [];
    }

    const json = JSON.parse(jsonMatch[1]);
    const rows = json.table?.rows || [];
    const cols = json.table?.cols || [];

    // Converter para array de objetos
    const headers = cols.map((col: any) => (col.label || col.id).trim());

    return rows.map((row: any) => {
      const obj: any = {};
      row.c?.forEach((cell: any, i: number) => {
        const header = headers[i];
        if (header) {
          let value = cell?.v ?? null;
          // Google Sheets gviz retorna datas como "Date(year,month,day)" (month 0-indexed)
          if (typeof value === 'string' && value.startsWith('Date(')) {
            const match = value.match(/Date\((\d+),(\d+),(\d+)\)/);
            if (match) {
              const year = match[1];
              const month = String(Number(match[2]) + 1).padStart(2, '0');
              const day = match[3].padStart(2, '0');
              value = `${year}-${month}-${day}`;
            }
          }
          obj[header] = value;
        }
      });
      return obj;
    });
  } catch (error) {
    console.error("Error fetching from Sheets:", error);
    return [];
  }
}

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
  if (range === "alltime") return { custom: false, key: "30d" };
  return { custom: false, key: "hoje" };
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

    // Buscar deals ativos e clientes fechados
    const [dealsAtivos, clientesFechados] = await Promise.all([
      fetchFromSheets("deals_ativos"),
      fetchFromSheets("clientes_fechados")
    ]);

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

    // Montar resposta no formato esperado pelo Dashboard
    const response = {
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
      ultimo_cliente: ultimoCliente,
      parceiros: {
        total: 5,
        lista: ["SecuriSoft", "EXHTech", "AlphaNetworking", "Adriano", "Otavio"]
      },
      deals_ativos: dealsAtivos || [],
      clientes_fechados: clientesFechados || [],
      _source: "google_sheets"
    };

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
