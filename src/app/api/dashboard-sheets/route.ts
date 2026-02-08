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
function mapPeriodo(range: string): string {
  if (range === "today") return "hoje";
  if (range === "7d") return "7d";
  if (range === "15d") return "15d";
  if (range === "30d") return "30d";
  if (range === "month") return "mes";
  if (range === "alltime") return "30d";
  return "hoje";
}

export async function GET(request: NextRequest) {
  // Verificar sessão
  const session = await verifySession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const periodo = searchParams.get("periodo") || "hoje";
  const periodoKey = mapPeriodo(periodo);

  // Verificar cache
  const cacheKey = `metricas_${periodoKey}`;
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
      .filter((row: any) => row.periodo === periodoKey)
      .sort((a: any, b: any) =>
        new Date(b.data_coleta).getTime() - new Date(a.data_coleta).getTime()
      );

    const metrica = metricasPeriodo[0];

    if (!metrica) {
      return NextResponse.json(
        { error: "Dados não encontrados para o período", periodo: periodoKey },
        { status: 404 }
      );
    }

    // Buscar deals ativos e clientes fechados
    const [dealsAtivos, clientesFechados] = await Promise.all([
      fetchFromSheets("deals_ativos"),
      fetchFromSheets("clientes_fechados")
    ]);

    // Montar resposta no formato esperado pelo Dashboard
    const response = {
      data: metrica.data_coleta,
      hora: new Date().toLocaleTimeString("pt-BR"),
      periodo: metrica.periodo === "hoje" ? metrica.data_coleta :
               metrica.periodo === "mes" ? "Este Mês" :
               `Últimos ${metrica.periodo.replace("d", "")} dias`,
      ligacoes: Number(metrica.ligacoes) || 0,
      ligacoes_atendidas: Number(metrica.ligacoes_atendidas) || 0,
      taxa_conectividade: Number(metrica.taxa_conectividade) || 0,
      emails: Number(metrica.emails) || 0,
      reunioes: Number(metrica.reunioes) || 0,
      apresentacoes: Number(metrica.apresentacoes) || 0,
      propostas: Number(metrica.propostas) || 0,
      deals_novos: Number(metrica.deals_novos) || Number(metrica.deals_ativos) || 0,
      deals_fechados: Number(metrica.deals_fechados) || 0,
      valor_pipeline: Number(metrica.valor_pipeline) || 0,
      valor_fechado: Number(metrica.valor_fechado) || 0,
      comissao_pipeline: Number(metrica.comissao_pipeline) || 0,
      comissao_fechado: Number(metrica.comissao_fechado) || 0,
      ticket_medio: Number(metrica.ticket_medio) || 0,
      win_rate: Number(metrica.win_rate) || 0,
      ultimo_cliente: metrica.ultimo_cliente_nome ? {
        nome: metrica.ultimo_cliente_nome,
        origem: metrica.ultimo_cliente_origem || "N/A",
        valor: Number(metrica.ultimo_cliente_valor) || 0,
        data: metrica.data_coleta
      } : null,
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
