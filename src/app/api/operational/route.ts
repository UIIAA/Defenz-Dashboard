import { NextRequest, NextResponse } from "next/server";
import { CACHE_TTL_MS } from "@/lib/cache-ttl";
import { verifySession } from "@/lib/auth";
import { fetchFromSheets } from "@/lib/sheets";
import { isActive, enrichDealsWithActivities, computeEsforcoDiario } from "@/lib/metrics";
import type { RawDeal, RawCall, RawEmail } from "@/lib/types";

const memoryCache = new Map<string, { data: any; timestamp: number }>();


export async function GET(request: NextRequest) {
  const session = await verifySession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cacheKey = "operational_v5";
  const cached = memoryCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({ ...cached.data, _cached: true });
  }

  try {
    const [deals, calls, emails] = await Promise.all([
      fetchFromSheets("deals") as Promise<RawDeal[]>,
      fetchFromSheets("ligacoes") as Promise<RawCall[]>,
      fetchFromSheets("emails") as Promise<RawEmail[]>,
    ]);

    // Filter to active/pipeline deals only
    const activeDeals = deals.filter(d => isActive(String(d.stage || '')));

    // Enrich deals with activities and staleness
    const enrichedDeals = enrichDealsWithActivities(activeDeals, calls, emails);

    const staleDeals = enrichedDeals.filter((d: any) => d.is_stale);
    const totalPipeline = enrichedDeals.reduce((s: number, d: any) => s + (Number(d.valor) || 0), 0);
    const avgDaysInStage = enrichedDeals.length > 0
      ? Math.round(enrichedDeals.reduce((s: number, d: any) => s + (Number(d.days_in_stage) || 0), 0) / enrichedDeals.length)
      : 0;

    // Compute daily effort (last 30 days)
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dailyEffort = computeEsforcoDiario(calls, emails, {
      start: thirtyDaysAgo.toISOString().split('T')[0],
      end: today.toISOString().split('T')[0],
    });

    const response = {
      deals: enrichedDeals,
      staleCount: staleDeals.length,
      totalDeals: enrichedDeals.length,
      totalPipeline,
      avgDaysInStage,
      esforco_diario: dailyEffort,
      _source: "google_sheets",
    };

    memoryCache.set(cacheKey, { data: response, timestamp: Date.now() });

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error in operational route:", error);
    return NextResponse.json({ error: "Erro ao buscar dados operacionais" }, { status: 500 });
  }
}
