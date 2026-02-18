import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { fetchFromSheets } from "@/lib/sheets";
import { correlateLeads } from "@/lib/correlate";
import { buildExecutiveExcel, computeKPIs } from "@/lib/excel-builder";

// Rate limit: 1 request per 30s per IP
const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_MS = 30_000;

export async function POST(request: NextRequest) {
  const session = await verifySession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limiting
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const lastReq = rateLimitMap.get(ip) || 0;
  if (Date.now() - lastReq < RATE_LIMIT_MS) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Wait 30 seconds." },
      { status: 429 }
    );
  }
  rateLimitMap.set(ip, Date.now());

  // Cleanup old entries
  if (rateLimitMap.size > 100) {
    const now = Date.now();
    for (const [key, ts] of rateLimitMap) {
      if (now - ts > RATE_LIMIT_MS * 2) rateLimitMap.delete(key);
    }
  }

  try {
    // Fetch all 7 sheets in parallel
    const [
      leadsCompleto,
      ligacoesRaw,
      emailsRaw,
      classificacoes,
      metricas,
      dealsAtivos,
      clientesFechados,
    ] = await Promise.all([
      fetchFromSheets("leads_completo"),
      fetchFromSheets("ligacoes_raw"),
      fetchFromSheets("emails_raw"),
      fetchFromSheets("classificacao_esforco"),
      fetchFromSheets("metricas"),
      fetchFromSheets("deals_ativos"),
      fetchFromSheets("clientes_fechados"),
    ]);

    // Get latest metricas row (30d or most recent)
    const metrica30d = metricas
      .filter((r: any) => r.periodo === "30d")
      .sort((a: any, b: any) =>
        String(b.data_coleta || "").localeCompare(String(a.data_coleta || ""))
      )[0] || metricas[0] || {};

    // Correlate leads with calls and emails
    const enrichedLeads = correlateLeads(
      leadsCompleto,
      ligacoesRaw,
      emailsRaw,
      classificacoes
    );

    // Compute KPIs
    const kpis = computeKPIs(enrichedLeads, metrica30d);

    // Build Excel
    const buffer = await buildExecutiveExcel(enrichedLeads, metrica30d, kpis);

    const today = new Date().toISOString().split("T")[0];
    const filename = `defenz_executivo_${today}.xlsx`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Error generating Excel:", error);
    return NextResponse.json(
      { error: "Erro ao gerar Excel executivo" },
      { status: 500 }
    );
  }
}
