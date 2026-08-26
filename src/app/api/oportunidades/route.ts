import { NextRequest, NextResponse } from "next/server";
import { CACHE_TTL_MS } from "@/lib/cache-ttl";
import { verifySession } from "@/lib/auth";
import { carregarOportunidades, hojeBRT } from "@/lib/oportunidades-fonte";

// feature-semaforo-oportunidades.
//
// ROTA PRÓPRIA, e não reuso: /api/operational usa `isActive` (78 deals, R$ 1,3 mi, inclui a
// geladeira) e baixa 5,8 MB de gviz que esta tela não usa.
//
// A resposta NÃO CARREGA `comissao_valor`. A tela é aberta ao time e o campo é a margem da
// Defenz por negócio — esconder no componente deixaria o dado chegar ao browser.

const memoryCache = new Map<string, { data: unknown; timestamp: number }>();

export async function GET(request: NextRequest) {
  const session = await verifySession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const hoje = hojeBRT();
  const cached = memoryCache.get(hoje);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({
      ...(cached.data as object),
      atualizado_em: new Date(cached.timestamp).toISOString(),
      _cached: true,
    });
  }

  try {
    const data = await carregarOportunidades(hoje);
    const timestamp = Date.now();
    memoryCache.set(hoje, { data, timestamp });
    return NextResponse.json({ ...data, atualizado_em: new Date(timestamp).toISOString() });
  } catch (error) {
    console.error("Error in oportunidades route:", error);
    return NextResponse.json({ error: "Erro ao carregar oportunidades" }, { status: 500 });
  }
}
