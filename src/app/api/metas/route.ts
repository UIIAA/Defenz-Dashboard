import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { fetchTabStrict, fetchFromSheets } from "@/lib/sheets";
import { computeMetas } from "@/lib/metas";
import type { RawResumoDiario, RawDeal, MetasResponse } from "@/lib/types";

// NOTE: verifySession protects this APP ROUTE only — same confidentiality note as
// /api/resumo-diario: the underlying sheet is a public gviz doc.

const memoryCache = new Map<string, { data: MetasResponse; timestamp: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min
const CACHE_KEY = "metas";

export async function GET(request: NextRequest) {
  const session = await verifySession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cached = memoryCache.get(CACHE_KEY);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({
      ...cached.data,
      _cached: true,
      _cacheAge: Math.round((Date.now() - cached.timestamp) / 1000),
    });
  }

  try {
    const [resumoRowsRaw, deals] = await Promise.all([
      fetchTabStrict("resumo_diario", ["data", "atualizado_em"]) as Promise<
        RawResumoDiario[] | null
      >,
      fetchFromSheets("deals") as Promise<RawDeal[]>,
    ]);

    const { semanas } = computeMetas(deals, resumoRowsRaw ?? [], new Date());

    const response: MetasResponse = {
      semanas,
      generatedAt: new Date().toISOString(),
    };

    memoryCache.set(CACHE_KEY, { data: response, timestamp: Date.now() });
    return NextResponse.json(response);
  } catch (error) {
    console.error("Error in metas route:", error);
    return NextResponse.json(
      { error: "Erro ao buscar métricas de metas" },
      { status: 500 }
    );
  }
}
