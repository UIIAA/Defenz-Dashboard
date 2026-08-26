import { NextRequest, NextResponse } from "next/server";
import { CACHE_TTL_MS } from "@/lib/cache-ttl";
import { verifySession } from "@/lib/auth";
import { fetchFromSheets } from "@/lib/sheets";
import { computeOportunidades } from "@/lib/oportunidades";
import type { RawDeal } from "@/lib/types";

// feature-semaforo-oportunidades.
//
// ROTA PRÓPRIA, e não reuso, por dois motivos medidos:
//  • /api/operational usa `isActive` (78 deals, inclui os 48 `Contato Futuro` = R$ 1,3 mi) e
//    baixa `ligacoes` 4,6 MB + `emails` 1,2 MB por cache miss — dado que esta tela não usa.
//  • /api/dashboard-sheets monta `deals_ativos` sem o que falta aqui.
//
// A resposta NÃO CARREGA `comissao_valor`. A tela é aberta ao time (spec §5.2) e o campo é a
// margem da Defenz por negócio — `Format Deals Raw` o preenche para todo deal. Esconder no
// componente não bastaria: o dado chegaria ao browser.

const memoryCache = new Map<string, { data: unknown; timestamp: number }>();

export async function GET(request: NextRequest) {
  const session = await verifySession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Data em America/Sao_Paulo: `dias_sem_toque` é contagem de dias corridos e viraria de dia
  // 3h antes da hora se usasse UTC.
  const hoje = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Sao_Paulo",
  });

  const cacheKey = `oportunidades_${hoje}`;
  const cached = memoryCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({ ...(cached.data as object), _cached: true });
  }

  try {
    const deals = (await fetchFromSheets("deals")) as RawDeal[];
    const data = computeOportunidades(deals, hoje);
    memoryCache.set(cacheKey, { data, timestamp: Date.now() });
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in oportunidades route:", error);
    return NextResponse.json(
      { error: "Erro ao carregar oportunidades" },
      { status: 500 }
    );
  }
}
