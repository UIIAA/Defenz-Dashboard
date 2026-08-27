// Estado do negócio e ficha do ambiente — feature-038.
// Spec: Defenz_Chief/docs/features/feature-038-estado-do-negocio.md
//
// Cálculo puro (sem rede, sem banco). O que mora aqui é só o que é DETERMINÍSTICO:
// o mapa estado → posse, a janela dos 90 dias, e a normalização do que chega torto.
//
// O QUE NÃO MORA AQUI: as 6 regras de leitura da §3 da spec (bloqueio ganha de tudo,
// compromisso datado ganha de tentativa, promessa vaga não é compromisso, etc.). Elas são
// instruções para o MODELO e vivem no runbook que a rotina do Chief lê a cada passagem.
// Não são testáveis em JS, e a validação delas é o modo seco contra a tabela da §6 da spec.
// A §9 da spec pede testes para elas; isso não é implementável e foi corrigido aqui.

/** Os 11 estados da §3 da spec, exatamente com os nomes gravados no picklist do Zoho. */
export const ESTADOS = [
  'Mapeamento de decisor',
  'Contato sem retorno',
  'Reunião a agendar',
  'Reunião agendada',
  'Retorno agendado',
  'Proposta em análise',
  'Aguardando aprovação interna',
  'Em negociação comercial',
  'Prova de conceito',
  'Fechamento em curso',
  'Bloqueio declarado',
] as const;

export type Estado = (typeof ESTADOS)[number];

/** De quem é a bola. Derivada do estado, NUNCA digitada (§3 da spec). */
export type Posse = 'nossa' | 'cliente' | 'parado';

const POSSE: Record<Estado, Posse> = {
  'Mapeamento de decisor': 'nossa',
  'Contato sem retorno': 'parado',
  'Reunião a agendar': 'nossa',
  'Reunião agendada': 'cliente',
  'Retorno agendado': 'cliente',
  'Proposta em análise': 'cliente',
  'Aguardando aprovação interna': 'cliente',
  'Em negociação comercial': 'cliente',
  'Prova de conceito': 'cliente',
  'Fechamento em curso': 'cliente',
  'Bloqueio declarado': 'parado',
};

/** Rótulo de grupo da tela, na ordem em que aparecem (§5 da spec). */
export const POSSE_TITULO: Record<Posse, string> = {
  parado: 'Parado, sem dono definido',
  nossa: 'A bola é nossa',
  cliente: 'A bola é do cliente',
};

export const ORDEM_POSSE: Posse[] = ['parado', 'nossa', 'cliente'];

/**
 * Texto exibido quando o dado não existe. §3: "nunca em branco, porque branco se confunde
 * com zero".
 */
export const EM_VALIDACAO = 'em validação';

function chave(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const POR_CHAVE = new Map<string, Estado>(ESTADOS.map((e) => [chave(e), e]));

/**
 * Normaliza o que veio do Zoho. Valor fora da lista dos 11 vira '' (a tela mostra como não
 * classificado e o contador do cabeçalho cobra), exatamente como a temperatura já faz.
 *
 * NÃO rejeitar: o picklist pode ganhar um valor novo no Zoho antes de o código saber dele, e
 * derrubar a tela por causa disso seria pior do que mostrar um card sem estado.
 */
export function normalizaEstado(v: unknown): Estado | '' {
  if (v === null || v === undefined) return '';
  return POR_CHAVE.get(chave(String(v))) ?? '';
}

export function posseDe(estado: Estado | ''): Posse | '' {
  return estado === '' ? '' : POSSE[estado];
}

/** Dias entre hoje e o vencimento. Negativo quando já venceu. null sem data válida. */
const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * O formato bater NÃO é a data existir: '2026-13-01' passa no regex e o mês 13 indexaria
 * fora do array de meses, imprimindo 'undefined/2026' na tela. Pego por teste.
 * O round-trip pelo Date é o que separa '2026-02-30' de uma data real.
 */
function partes(d: string | null): [number, number, number] | null {
  if (!d || !DATA_RE.test(d)) return null;
  const [a, m, dia] = [+d.slice(0, 4), +d.slice(5, 7), +d.slice(8, 10)];
  const t = new Date(Date.UTC(a, m - 1, dia));
  if (t.getUTCFullYear() !== a || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== dia) return null;
  return [a, m, dia];
}

export function diasParaVencer(vencimento: string | null, hoje: string): number | null {
  const v = partes(vencimento);
  const h = partes(hoje);
  if (!v || !h) return null;
  const a = Date.UTC(h[0], h[1] - 1, h[2]);
  const b = Date.UTC(v[0], v[1] - 1, v[2]);
  return Math.round((b - a) / 86_400_000);
}

export const JANELA_DIAS = 90;

/**
 * §3 da spec: "Janela = vencimento dentro de 90 dias". Não é um 12º estado, é um marcador
 * que convive com o estado.
 *
 * DECISÃO NÃO COBERTA PELA SPEC: licença JÁ VENCIDA conta como dentro da janela. Uma licença
 * que venceu mês passado não é menos urgente que uma que vence semana que vem, é mais. Hoje
 * isso não muda número nenhum (o vencimento mais próximo no pipe é 01/09/2026), mas muda
 * quando aparecer o primeiro atrasado. A tela distingue os dois casos pelo sinal de
 * `dias_para_vencer`.
 */
export function naJanela(dias: number | null): boolean {
  return dias !== null && dias <= JANELA_DIAS;
}

/** Ordem de exibição do grupo. Estado ausente vai para o fim, ver comentário em ORDEM_GRUPO. */
export function ordemGrupo(posse: Posse | ''): number {
  if (posse === '') return ORDEM_POSSE.length;
  return ORDEM_POSSE.indexOf(posse);
}

/**
 * Ficha do ambiente, já formatada para a tela. Nulo vira 'em validação' (§3).
 * `licencas` é 0 quando ausente porque a coluna do Neon é `not null default 0`.
 */
export interface Ficha {
  licencas: string;
  antivirus: string;
  vencimento: string;
}

const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** 'YYYY-MM-DD' → 'nov/2026'. O dia não interessa a quem lê a lista. */
export function mesAno(vencimento: string | null): string {
  const p = partes(vencimento);
  return p ? `${MES[p[1] - 1]}/${p[0]}` : EM_VALIDACAO;
}

export function montaFicha(
  licencas: number,
  antivirus: string | null,
  vencimento: string | null
): Ficha {
  return {
    licencas: licencas > 0 ? `${licencas} lic` : EM_VALIDACAO,
    antivirus: antivirus && antivirus.trim() ? antivirus.trim() : EM_VALIDACAO,
    vencimento: mesAno(vencimento),
  };
}
