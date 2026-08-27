// Fonte única do corpo do Code node `Format Deals Raw` do n8n.
//
// POR QUE ESTE ARQUIVO EXISTE: até 27/08/2026 este código vivia COPIADO dentro de dois
// workflows — `QjnzGicZHIPBNN1g` (Coleta Métricas v2) e `WlTnk2bHWYhibwyG` (Refresh Deals sob
// demanda) — e cada campo novo exigia editar as duas cópias à mão. Já tinham passado por isso
// `licencas`, `temperatura` e `vencimento_licenca`. Agora existe um sub-workflow único
// (`Defenz - Dashboard - Sub - Format Deals Raw`) que os dois chamam, e o corpo dele mora AQUI.
//
// DEPOIS DE MEXER NESTE ARQUIVO:
//     node scripts/sync-n8n-code.mjs --push     sobe o corpo para o sub-workflow
//     node scripts/sync-n8n-code.mjs --check    falha se o n8n divergiu do repo
//
// O `--check` é o que impede a divergência de voltar calada. Sem ele, "lembrar de subir" é
// procedimento — e procedimento foi exatamente o que falhou nas três edições duplas anteriores.
//
// AS REGRAS AQUI VALEM DINHEIRO: `classifyOrigin` decide a taxa de comissão da Defenz
// (5% Securisoft / 43% parceiro / 58% direto). Ver CLAUDE.md § Lógica de Comissão.
//
// SEM SENTINELA. Até 27/08/2026 a cópia da coleta emitia uma linha `id: 'none'` quando o Zoho
// respondia sem negócio. Ela nunca disparou (0 de 300 linhas na aba) e, se disparasse, gravaria
// lixo na planilha e no Neon em vez de avisar alguém. Payload vazio agora escreve NADA — que já
// era o comportamento do refresh desde que ele nasceu.

function classifyOrigin(leadSource) {
  const src = (leadSource || '').toLowerCase().trim();
  if (src.includes('securisoft') || src.includes('parceiro ss')) {
    return { categoria: 'securisoft', taxa: 0.05 };
  }
  if (src.includes('apollo') || src.includes('linkedin') || src.includes('cold call') || src.includes('chamada surpresa')) {
    return { categoria: 'direto', taxa: 0.58 };
  }
  if (src.includes('parceiro')) {
    return { categoria: 'parceiro', taxa: 0.43 };
  }
  return { categoria: 'direto', taxa: 0.58 };
}

// feature-cnpj-identidade-empresa (01/08/2026).
// O campo CNPJ do Zoho e TEXTO LIVRE: um deal traz a palavra "Localizando", outro um CNPJ
// truncado. A unica porta de entrada e o digito verificador — sem saneamento, sem lista de
// excecoes. CNPJ1 e residuo em 6 dos 7 casos, mas no setimo carrega o valor real justamente
// quando o principal tem lixo: serve como FALLBACK, nunca como segunda identidade.
// Emitido FORMATADO de proposito: '10843079000176' viraria numero no Sheets (USER_ENTERED)
// e perderia zero a esquerda.
function cnpjValido(c) {
  if (!/^\d{14}$/.test(c) || /^(\d)\1{13}$/.test(c)) return false;
  const dv = (base) => {
    const pesos = base.length === 12 ? [5,4,3,2,9,8,7,6,5,4,3,2] : [6,5,4,3,2,9,8,7,6,5,4,3,2];
    let s = 0;
    for (let i = 0; i < base.length; i++) s += Number(base[i]) * pesos[i];
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return Number(c[12]) === dv(c.slice(0, 12)) && Number(c[13]) === dv(c.slice(0, 13));
}

function cnpjCanonico() {
  for (const campo of arguments) {
    const c = String(campo == null ? '' : campo).replace(/\D/g, '');
    if (cnpjValido(c)) return `${c.slice(0,2)}.${c.slice(2,5)}.${c.slice(5,8)}/${c.slice(8,12)}-${c.slice(12)}`;
  }
  return '';
}

function toStr(v) {
  if (v == null) return '';
  if (typeof v === 'object') return String(v.name || v.full_name || '');
  return String(v);
}

// feature-semaforo-oportunidades §4.1 — o `resultados` guardava os 1000 chars MAIS ANTIGOS
// (slice(0,1000)), descartando o historico recente. Medido: 125 de 260 truncados, media de 33
// dias invisiveis, pior caso 142. Isso subcontava reunioes/apresentacoes/propostas (derivadas
// deste campo em metrics.ts) e impedia saber o ultimo toque real de cada negocio.
//
// CORTAR NA QUEBRA DE LINHA, NUNCA NO CHAR. O parser (extractEventDatesAnchored) trabalha por
// linha e pega o PRIMEIRO \d{2}/\d{2} dela; o formato real e `DD/MM - texto ... [TAG]`. Cortar
// no meio decapita a data e PRESERVA a tag — simulado nos 260 reais: 63 fragmentos ficariam com
// tag, 59 sumiriam calados e 4 emitiriam data pescada de outro numero da linha.
const LIM_RESULTADOS = 4000;
function caudaResultados(texto) {
  const r = toStr(texto);
  if (r.length <= LIM_RESULTADOS) return r;
  const corte = r.indexOf('\n', r.length - LIM_RESULTADOS);
  return corte === -1 ? r.slice(-LIM_RESULTADOS) : r.slice(corte + 1);
}

// feature-semaforo-oportunidades §6 — semaforo manual declarado no Zoho (picklist
// Quente/Morno/Frio). Normaliza AQUI, nao na tela: o picklist pode ganhar valor novo, o
// `-None-` chega vazio, e alguem pode digitar com espaco. Valor desconhecido vira '' (cinza).
// NAO usar Classificacao_IA: e do ramo de IA desligado em 12/08, seria um segundo dono da
// mesma verdade.
const TEMPS = ['quente', 'morno', 'frio'];
function normalizaTemperatura(v) {
  const t = toStr(v).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  return TEMPS.indexOf(t) >= 0 ? t : '';
}

/**
 * Recebe as PÁGINAS cruas do nó `Zoho Deals` (cada item é o corpo de uma resposta HTTP, com
 * `data` e `info`) e devolve uma linha por negócio. Não conhece quem chamou.
 */
function formatarDeals(pages) {
  const deals = pages.flatMap(page => (page.json && page.json.data) || []);

  const formatted = deals.map(d => {
    const valor = Number(d.Amount) || 0;
    const leadSource = toStr(d.Lead_Source);
    const { categoria, taxa } = classifyOrigin(leadSource);
    const empresa = toStr(d.Account_Name).trim();
    const cnpj = cnpjCanonico(d.CNPJ, d.CNPJ1);
    const tags = Array.isArray(d.Tag) ? d.Tag.map(function(t){ return (t && t.name) || ''; }).filter(Boolean).join(', ') : '';

    return {
      id: toStr(d.id),
      nome: toStr(d.Deal_Name),
      empresa: empresa.length > 0 ? empresa : '',
      cnpj,
      stage: toStr(d.Stage),
      valor,
      lead_source: leadSource,
      categoria,
      comissao_valor: Math.round(valor * taxa),
      created_time: toStr(d.Created_Time).slice(0, 10),
      modified_time: toStr(d.Modified_Time).slice(0, 10),
      closing_date: toStr(d.Closing_Date).slice(0, 10),
      resultados: caudaResultados(d.Resultados),
      temperatura: normalizaTemperatura(d.Temperatura),
      tags: tags,
      licencas: parseInt(d.N_de_Endpoints, 10) || 0,
    // feature-038 (dono) — o `Owner` já era pedido ao Zoho no `fields` do nó `Zoho Deals` e
    // era JOGADO FORA aqui: nenhuma tela sabia de quem era o negócio.
    //
    // DOIS ACESSOS EXPLÍCITOS, e não `toStr(d.Owner)`: o `toStr` acima devolve `v.name` quando
    // recebe objeto, então `toStr(d.Owner)` daria o NOME no lugar do id — e o id é justamente
    // a metade estável. O nome de exibição do Zoho é editável ("vendor 2" é conta genérica).
    //
    // DUAS COLUNAS de propósito: `src/lib/donos.ts` amarra a exibição no id, e guardar o nome
    // cru é o que faz vendedor novo aparecer na tela antes de alguém cadastrar o id no mapa.
    owner_id: toStr(d.Owner && d.Owner.id),
    owner_nome: toStr(d.Owner && d.Owner.name),
      // feature-038 — `Vencimeno_da_licen_a` (o typo E o api_name real) e um campo `date` do
      // Zoho que ja existia e simplesmente nao estava sendo exportado. Preenchido em 11 dos 29
      // cards do pipe em 27/08. E a fonte do vencimento, e o modelo da f-038 so preenche onde
      // ele estiver vazio. NAO ha coluna na aba `deals`: o item carrega o campo ate o
      // `Lote -> Neon`, igual a temperatura.
      vencimento_licenca: toStr(d.Vencimeno_da_licen_a).slice(0, 10),
    };
  });

  return formatted;
}

/* === daqui para baixo é só para o teste local; o sync corta antes de subir para o n8n === */
export {
  formatarDeals,
  classifyOrigin,
  cnpjValido,
  cnpjCanonico,
  toStr,
  caudaResultados,
  normalizaTemperatura,
  LIM_RESULTADOS,
};
