import { NextRequest, NextResponse } from "next/server";
import { CACHE_TTL_LONGO_MS } from "@/lib/cache-ttl";
import { verifySession } from "@/lib/auth";
import { fetchFromSheets } from "@/lib/sheets";
import { computeFaturamentoMensal } from "@/lib/metrics";
import type { RawDeal } from "@/lib/types";

const memoryCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL_MS = CACHE_TTL_LONGO_MS;

export async function GET(request: NextRequest) {
  const session = await verifySession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const anoParam = searchParams.get("ano");
  const ano = anoParam ? parseInt(anoParam) : undefined;

  if (ano !== undefined && (isNaN(ano) || ano < 2020 || ano > 2100)) {
    return NextResponse.json({ error: "Parâmetro 'ano' inválido" }, { status: 400 });
  }

  const cacheKey = `faturamento_mensal_${ano ?? 'all'}`;
  const cached = memoryCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({
      ...cached.data,
      _cached: true,
      _cacheAge: Math.round((Date.now() - cached.timestamp) / 1000),
    });
  }

  try {
    const deals = await fetchFromSheets("deals") as RawDeal[];
    const result = computeFaturamentoMensal(deals, ano);

    const response = {
      ...result,
      ano: ano ?? null,
      _source: "google_sheets",
    };

    memoryCache.set(cacheKey, { data: response, timestamp: Date.now() });
    return NextResponse.json(response);
  } catch (error) {
    console.error("Error in faturamento-mensal route:", error);
    return NextResponse.json(
      { error: "Erro ao buscar dados de faturamento" },
      { status: 500 }
    );
  }
}
