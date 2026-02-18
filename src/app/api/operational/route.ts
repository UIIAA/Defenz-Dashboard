import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { fetchFromSheets } from "@/lib/sheets";

const memoryCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000;

const STALE_THRESHOLD_DAYS = 7;

export async function GET(request: NextRequest) {
  const session = await verifySession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cacheKey = "operational_data";
  const cached = memoryCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({ ...cached.data, _cached: true });
  }

  try {
    const [dealsAtivos, atividades, eforcoDiario] = await Promise.all([
      fetchFromSheets("deals_ativos"),
      fetchFromSheets("atividades"),
      fetchFromSheets("esforco_diario")
    ]);

    // Index activities by deal_id
    const activityByDeal: Record<string, any[]> = {};
    atividades.forEach((a: any) => {
      const dealId = String(a.deal_id || '');
      if (!activityByDeal[dealId]) activityByDeal[dealId] = [];
      activityByDeal[dealId].push(a);
    });

    // Sort activities per deal by date desc
    Object.values(activityByDeal).forEach(arr => {
      arr.sort((a: any, b: any) => (b.data || '').localeCompare(a.data || ''));
    });

    const today = new Date().toISOString().split('T')[0];

    // Enrich deals with activities and stale status
    const enrichedDeals = dealsAtivos.map((deal: any) => {
      const dealId = String(deal.id || '');
      const activities = activityByDeal[dealId] || [];
      const lastActivity = activities[0];
      const daysInStage = Number(deal.days_in_stage) || 0;

      // Determine staleness
      let isStale = false;
      if (lastActivity?.data) {
        const lastDate = new Date(lastActivity.data);
        const diffDays = Math.round((new Date(today).getTime() - lastDate.getTime()) / 86400000);
        isStale = diffDays >= STALE_THRESHOLD_DAYS;
      } else {
        // No activity at all = stale
        isStale = true;
      }

      return {
        ...deal,
        valor: Number(deal.valor) || 0,
        comissao_valor: Number(deal.comissao_valor) || 0,
        days_in_stage: daysInStage,
        modified_time: deal.modified_time || '',
        last_activity_date: lastActivity?.data || deal.last_activity_date || '',
        last_activity_type: lastActivity?.tipo || deal.last_activity_type || 'none',
        activities,
        is_stale: isStale,
      };
    });

    const staleDeals = enrichedDeals.filter((d: any) => d.is_stale);
    const totalPipeline = enrichedDeals.reduce((s: number, d: any) => s + (Number(d.valor) || 0), 0);
    const avgDaysInStage = enrichedDeals.length > 0
      ? Math.round(enrichedDeals.reduce((s: number, d: any) => s + (Number(d.days_in_stage) || 0), 0) / enrichedDeals.length)
      : 0;

    // Parse esforco_diario rows
    const dailyEffort = eforcoDiario.map((row: any) => ({
      data: String(row.data || ''),
      calls: Number(row.calls) || 0,
      emails: Number(row.emails) || 0,
      meetings: Number(row.meetings) || 0,
      total: Number(row.total) || 0,
    })).filter((r: any) => r.data).sort((a: any, b: any) => a.data.localeCompare(b.data));

    const response = {
      deals: enrichedDeals,
      staleCount: staleDeals.length,
      totalDeals: enrichedDeals.length,
      totalPipeline,
      avgDaysInStage,
      esforco_diario: dailyEffort,
      _source: "google_sheets"
    };

    memoryCache.set(cacheKey, { data: response, timestamp: Date.now() });

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error in operational route:", error);
    return NextResponse.json({ error: "Erro ao buscar dados operacionais" }, { status: 500 });
  }
}
