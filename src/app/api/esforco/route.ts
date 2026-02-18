import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { fetchFromSheets } from "@/lib/sheets";

const memoryCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000;

const RESPOSTA_LABELS: Record<string, string> = {
  interessado: "Interessado",
  tem_concorrente: "Tem Concorrente",
  sem_orcamento: "Sem Orcamento",
  nao_agora: "Nao Agora",
  recusou: "Recusou",
  agendou_reuniao: "Agendou Reuniao",
  enviou_proposta: "Enviou Proposta",
  em_negociacao: "Em Negociacao",
  sem_resposta: "Sem Resposta",
  inconclusivo: "Inconclusivo",
};

export async function GET(request: NextRequest) {
  const session = await verifySession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cacheKey = "esforco_data";
  const cached = memoryCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({ ...cached.data, _cached: true });
  }

  try {
    const rows = await fetchFromSheets("classificacao_esforco");

    if (!rows || rows.length === 0) {
      return NextResponse.json({
        classificacoes: [],
        metrics: {
          deals_com_resultados: 0,
          taxa_gatekeeper: 0,
          taxa_decisor: 0,
          toques_medio: 0,
          resposta_top1: "-",
          concorrente_top1: "-",
          deals_com_concorrente: 0,
        },
        funnel: [],
        respostas: [],
        concorrentes: [],
        _source: "google_sheets",
      });
    }

    // Parse classifications
    const classificacoes = rows.map((r: any) => ({
      lead_id: String(r.lead_id || r.deal_id || ''),
      lead_name: String(r.lead_name || r.deal_name || ''),
      data_classificacao: String(r.data_classificacao || ''),
      nivel_maximo: String(r.nivel_maximo || 'inconclusivo'),
      passou_secretaria: String(r.passou_secretaria || '').toLowerCase() === 'sim',
      resultado_principal: String(r.resultado_principal || 'inconclusivo'),
      concorrente: String(r.concorrente || ''),
      renovacao_concorrente: String(r.renovacao_concorrente || ''),
      toques_estimados: Number(r.toques_estimados) || 0,
      pessoa_contactada: String(r.pessoa_contactada || ''),
      cargo_estimado: String(r.cargo_estimado || 'desconhecido'),
      resumo: String(r.resumo || ''),
    }));

    const total = classificacoes.length;

    // Compute funnel steps
    const contatoEstabelecido = classificacoes.filter(
      (c: any) => c.nivel_maximo !== 'nenhum_contato' && c.nivel_maximo !== 'tag_apenas'
    ).length;
    const passouSecretaria = classificacoes.filter((c: any) => c.passou_secretaria).length;
    const decisorTecnico = classificacoes.filter(
      (c: any) => c.nivel_maximo === 'tecnico' || c.nivel_maximo === 'decisor'
    ).length;
    const interesseProposta = classificacoes.filter(
      (c: any) => ['interessado', 'agendou_reuniao', 'enviou_proposta', 'em_negociacao'].includes(c.resultado_principal)
    ).length;

    const funnel = [
      { label: "Leads c/ Resultados", value: total, percent: 100 },
      { label: "Contato Estabelecido", value: contatoEstabelecido, percent: total > 0 ? Math.round((contatoEstabelecido / total) * 100) : 0 },
      { label: "Passou Secretaria", value: passouSecretaria, percent: total > 0 ? Math.round((passouSecretaria / total) * 100) : 0 },
      { label: "Decisor/Tecnico", value: decisorTecnico, percent: total > 0 ? Math.round((decisorTecnico / total) * 100) : 0 },
      { label: "Interesse/Proposta", value: interesseProposta, percent: total > 0 ? Math.round((interesseProposta / total) * 100) : 0 },
    ];

    // Compute response distribution
    const respostaCounts: Record<string, number> = {};
    classificacoes.forEach((c: any) => {
      const key = c.resultado_principal || 'inconclusivo';
      respostaCounts[key] = (respostaCounts[key] || 0) + 1;
    });
    const respostas = Object.entries(respostaCounts)
      .map(([key, count]) => ({ label: RESPOSTA_LABELS[key] || key, count }))
      .sort((a, b) => b.count - a.count);

    // Compute competitor info
    const concorrenteMap: Record<string, { deals: number; renovacoes: string[] }> = {};
    classificacoes.forEach((c: any) => {
      if (!c.concorrente) return;
      if (!concorrenteMap[c.concorrente]) {
        concorrenteMap[c.concorrente] = { deals: 0, renovacoes: [] };
      }
      concorrenteMap[c.concorrente].deals++;
      if (c.renovacao_concorrente) {
        concorrenteMap[c.concorrente].renovacoes.push(c.renovacao_concorrente);
      }
    });
    const concorrentes = Object.entries(concorrenteMap)
      .map(([nome, info]) => ({
        nome,
        deals: info.deals,
        renovacao: info.renovacoes.sort()[0] || '',
      }))
      .sort((a, b) => b.deals - a.deals);

    // Compute aggregate metrics
    const taxaGatekeeper = total > 0 ? Math.round((passouSecretaria / total) * 100) : 0;
    const taxaDecisor = total > 0 ? Math.round((decisorTecnico / total) * 100) : 0;
    const toquesMedio = total > 0
      ? Math.round((classificacoes.reduce((s: number, c: any) => s + c.toques_estimados, 0) / total) * 10) / 10
      : 0;

    const metrics = {
      deals_com_resultados: total,
      taxa_gatekeeper: taxaGatekeeper,
      taxa_decisor: taxaDecisor,
      toques_medio: toquesMedio,
      resposta_top1: respostas[0]?.label || '-',
      concorrente_top1: concorrentes[0]?.nome || '-',
      deals_com_concorrente: concorrentes.reduce((s, c) => s + c.deals, 0),
    };

    const response = {
      classificacoes,
      metrics,
      funnel,
      respostas,
      concorrentes,
      _source: "google_sheets",
    };

    memoryCache.set(cacheKey, { data: response, timestamp: Date.now() });

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error in esforco route:", error);
    return NextResponse.json({ error: "Erro ao buscar dados de esforco" }, { status: 500 });
  }
}
