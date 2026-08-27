// Oportunidades abertas — feature-semaforo-oportunidades.
// Cálculo puro (sem rede, sem banco) para ser testável sozinho.

import { isClosedWon, isClosedLost } from './metrics';
import { ultimoToque } from './ultimo-toque';
import {
  normalizaEstado,
  posseDe,
  diasParaVencer,
  naJanela,
  ordemGrupo,
  type Estado,
  type Posse,
} from './estado';
import type { RawDeal } from './types';

export type Temperatura = 'quente' | 'morno' | 'frio';

/** Estágio da geladeira: tem gatilho datado próprio, não é oportunidade em andamento. */
const GELADEIRA = 'contato futuro';

/**
 * Aberto = NÃO é fechado (ganho/perdido) e NÃO é a geladeira.
 *
 * DENYLIST de propósito. A v1 da spec usava uma allowlist de 6 estágios — e um estágio novo
 * ou renomeado sumiria da tela EM SILÊNCIO. Foi assim que `Grandes Contas` (existe no picklist
 * do Zoho) não apareceu na spec. Com denylist, estágio desconhecido aparece; que é o
 * comportamento seguro para uma tela cujo trabalho é não deixar negócio esquecido.
 */
export function isAberto(stage: string): boolean {
  const s = String(stage || '').toLowerCase().trim();
  if (!s) return false;
  return !isClosedWon(s) && !isClosedLost(s) && s !== GELADEIRA;
}

export interface Oportunidade {
  id: string;
  nome: string;
  stage: string;
  valor: number;
  licencas: number;
  /** '' quando não classificado — a tela mostra cinza e cobra. */
  temperatura: Temperatura | '';
  /** Último registro datado do `resultados`. null quando o texto não tem data. */
  ultimo_toque: string | null;
  dias_sem_toque: number | null;
  /** Texto literal do último andamento escrito pelo vendedor no Zoho. */
  ultimo_andamento: string | null;
  // --- feature-038 ---
  /** '' quando a rotina ainda não classificou, ou quando o valor saiu da lista dos 11. */
  estado: Estado | '';
  /** Derivada do estado, nunca digitada. '' quando não há estado. */
  posse: Posse | '';
  /** Antivírus que o cliente usa hoje. null vira 'em validação' na tela. */
  antivirus_atual: string | null;
  /** 'YYYY-MM-DD' do campo `Vencimeno_da_licen_a` do Zoho. */
  vencimento: string | null;
  /** Negativo quando já venceu. null sem data. */
  dias_para_vencer: number | null;
  /** Vencimento em até 90 dias (ou já vencido). Marcador, não é um 12º estado. */
  janela: boolean;
  // SEM comissao_valor: a tela é aberta ao time (spec §5.2) e o campo é margem da Defenz.
}

export interface GrupoPosse {
  posse: Posse | '';
  n: number;
  valor: number;
}

export interface OportunidadesResult {
  itens: Oportunidade[];
  total: number;
  valor_total: number;
  /** Sem temperatura. */
  sem_classificacao: number;
  // --- feature-038 ---
  /** Sem estado do negócio. Enquanto a rotina do Chief não roda, é igual a `total`. */
  sem_estado: number;
  /** Contagem e valor por posse, na ordem de exibição. Só grupos com pelo menos 1 card. */
  grupos: GrupoPosse[];
  /** Vencendo em até 90 dias, do maior valor para o menor. */
  janela: { id: string; nome: string; valor: number; vencimento: string }[];
}

const TEMPS: Temperatura[] = ['quente', 'morno', 'frio'];

function normalizaTemp(v: unknown): Temperatura | '' {
  const t = String(v ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
  return (TEMPS as string[]).includes(t) ? (t as Temperatura) : '';
}

export function computeOportunidades(
  deals: RawDeal[],
  hoje: string
): OportunidadesResult {
  const itens: Oportunidade[] = [];

  for (const d of deals) {
    if (!isAberto(String(d.stage || ''))) continue;
    const toque = ultimoToque(String(d.resultados || ''), hoje);
    const estado = normalizaEstado(d.estado_negocio);
    const venc = d.vencimento_licenca ? String(d.vencimento_licenca).slice(0, 10) : null;
    const dias = diasParaVencer(venc, hoje);
    const av = String(d.antivirus_atual ?? '').trim();
    itens.push({
      id: String(d.id ?? ''),
      nome: String(d.nome ?? ''),
      stage: String(d.stage ?? ''),
      valor: Number(d.valor) || 0,
      licencas: Number(d.licencas) || 0,
      temperatura: normalizaTemp(d.temperatura),
      ultimo_toque: toque.data,
      dias_sem_toque: toque.dias,
      ultimo_andamento: toque.texto,
      estado,
      posse: posseDe(estado),
      antivirus_atual: av || null,
      vencimento: venc,
      dias_para_vencer: dias,
      janela: naJanela(dias),
    });
  }

  // Agrupado por posse (parado, nossa, cliente, e sem estado por último), maior valor
  // primeiro dentro de cada grupo. §5 da spec da f-038.
  //
  // MUDOU em relação à f-semaforo: antes o card SEM TEMPERATURA vinha no topo, para a tela
  // cobrar. Com o estado, esse bucket nasce com os 68 cards e enterraria os R$ 93 mil de
  // "parado", que é justamente o que a tela existe para mostrar. A cobrança passou para os
  // contadores do cabeçalho, que continuam contando os dois casos.
  itens.sort((a, b) => {
    const ga = ordemGrupo(a.posse);
    const gb = ordemGrupo(b.posse);
    if (ga !== gb) return ga - gb;
    return b.valor - a.valor;
  });

  const grupos: GrupoPosse[] = [];
  for (const o of itens) {
    const g = grupos.find((x) => x.posse === o.posse);
    if (g) {
      g.n += 1;
      g.valor += o.valor;
    } else {
      grupos.push({ posse: o.posse, n: 1, valor: o.valor });
    }
  }

  return {
    itens,
    total: itens.length,
    valor_total: itens.reduce((s, x) => s + x.valor, 0),
    sem_classificacao: itens.filter((x) => x.temperatura === '').length,
    sem_estado: itens.filter((x) => x.estado === '').length,
    grupos,
    janela: itens
      .filter((x) => x.janela && x.vencimento)
      .sort((a, b) => b.valor - a.valor)
      .map((x) => ({ id: x.id, nome: x.nome, valor: x.valor, vencimento: x.vencimento! })),
  };
}
