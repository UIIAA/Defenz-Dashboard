import { NextRequest, NextResponse } from "next/server";
import { CACHE_TTL_MS } from "@/lib/cache-ttl";
import { verifySession } from "@/lib/auth";
import { fetchFromSheets } from "@/lib/sheets";

const memoryCache = new Map<string, { data: any; timestamp: number }>();


export async function GET(request: NextRequest) {
  const session = await verifySession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cacheKey = "agenda_data";
  const cached = memoryCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({ ...cached.data, _cached: true });
  }

  try {
    const rows = await fetchFromSheets("agenda");
    const hoje = new Date().toISOString().split('T')[0];
    const in7Days = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

    if (!rows || rows.length === 0) {
      return NextResponse.json({
        items: [],
        total: 0,
        overdue: 0,
        upcoming_7d: 0,
        _source: "google_sheets",
      });
    }

    const items = rows.map((r: any) => ({
      task_id: String(r.task_id || ''),
      lead_id: String(r.lead_id || ''),
      lead_name: String(r.lead_name || ''),
      empresa: String(r.empresa || '-'),
      subject: String(r.subject || ''),
      due_date: String(r.due_date || ''),
      status: String(r.status || ''),
      description: String(r.description || ''),
      owner: String(r.owner || ''),
      is_overdue: String(r.is_overdue || '').toLowerCase() === 'sim',
      lead_status: String(r.lead_status || '-'),
    }));

    const total = items.length;
    const overdue = items.filter((i: any) => i.is_overdue).length;
    const upcoming_7d = items.filter((i: any) => {
      const d = i.due_date;
      return d >= hoje && d <= in7Days;
    }).length;

    const response = {
      items,
      total,
      overdue,
      upcoming_7d,
      _source: "google_sheets",
    };

    memoryCache.set(cacheKey, { data: response, timestamp: Date.now() });

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error in agenda route:", error);
    return NextResponse.json({ error: "Erro ao buscar dados de agenda" }, { status: 500 });
  }
}
