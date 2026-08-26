import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { carregarOportunidades, hojeBRT } from "@/lib/oportunidades-fonte";

// feature-semaforo-oportunidades — o botão "Atualizar".
//
// Dispara o workflow `Defenz - Dashboard - Refresh Deals (sob demanda)` (n8n, id
// WlTnk2bHWYhibwyG), que puxa SÓ os deals do Zoho (~8s medido) e grava na aba e no Neon.
// Depois relê e devolve o payload fresco — o cliente usa esta resposta direto, sem depender
// de o cache da rota GET estar na mesma instância serverless.
//
// POR QUE NÃO LER O ZOHO DAQUI: exigiria OAuth do Zoho na Vercel — segredo novo, com token
// que expira (a integração do Microsoft Calendar está fora do ar até hoje exatamente assim).
// A credencial fica onde já está, no n8n; o dashboard só carrega um token de webhook.
//
// TRAVA: o front chama isto no primeiro carregamento. Sem trava, alternar de aba dispararia o
// workflow toda vez. A janela mínima é do lado do cliente E aqui, porque o cliente mente.

const JANELA_MS = 2 * 60 * 1000;
let ultimoDisparo = 0;

export async function POST(request: NextRequest) {
  const session = await verifySession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = process.env.N8N_REFRESH_DEALS_URL;
  const token = process.env.INGEST_TOKEN;
  const hoje = hojeBRT();

  const agora = Date.now();
  const cedoDemais = agora - ultimoDisparo < JANELA_MS;

  if (url && token && !cedoDemais) {
    ultimoDisparo = agora;
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Ingest-Token": token },
        body: "{}",
        signal: AbortSignal.timeout(60_000),
      });
      if (!r.ok) console.error("refresh: n8n devolveu", r.status);
    } catch (e) {
      // O workflow falhar não pode quebrar a tela: relemos o que já existe e seguimos.
      console.error("refresh: n8n indisponível", e);
    }
  } else if (!url || !token) {
    console.error("refresh: N8N_REFRESH_DEALS_URL ou INGEST_TOKEN ausente — só releitura");
  }

  try {
    const data = await carregarOportunidades(hoje);
    return NextResponse.json({
      ...data,
      atualizado_em: new Date().toISOString(),
      _throttled: cedoDemais,
    });
  } catch (error) {
    console.error("Error in oportunidades/refresh:", error);
    return NextResponse.json({ error: "Erro ao atualizar oportunidades" }, { status: 500 });
  }
}
