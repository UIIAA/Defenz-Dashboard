// feature-041 §3.3 — a ÚNICA definição de estágio do repo.
//
// Antes existiam quatro leituras convivendo, todas chamadas de "pipe": `isPipeline` (9
// negócios), `isAberto` (63), `isActive` (108) e a allowlist do farol da f-037 (24). A
// `isPipeline` era allowlist de 3 estágios e descartava 54 negócios EM SILÊNCIO — 11 de
// Reunião Técnica, 4 de Proposta / Governo e as 39 Grandes Contas.
//
// DENYLIST, SEMPRE. Estágio novo ou renomeado no Zoho tem que APARECER, nunca sumir: foi uma
// allowlist que fez `Grandes Contas` nascer invisível na v1 da spec do semáforo. Numa tela cujo
// trabalho é não deixar negócio esquecido, o comportamento seguro é mostrar o desconhecido.
//
// ⚠️ O QUE ESTE ARQUIVO **NÃO** É: a regra de seleção do farol da f-037 (Code node
// `Filtrar Pipe` do WF `609dj477lHEPBX6J`). Aquele nó responde outra pergunta — "quem a IA deve
// classificar" — e a allowlist dele é escopo deliberado, não defeito. Substituí-la por
// `isAberto()` levaria as 39 Grandes Contas para a classificação por IA, com custo de Gemini
// junto, e invalidaria o aviso de temperatura congelada da f-040 (R2.4). Para lá vale copiar o
// VOCABULÁRIO, não a seleção.

/** Normaliza para comparar: sem acento, sem caixa, sem borda. */
function norm(stage: string): string {
  return String(stage ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export const ETAPAS_GANHAS = ['fechado ganho', 'contrato enviado'];

export const ETAPAS_PERDIDAS = [
  'fechado perdido',
  'fechado perdido para a concorrencia',
  'perdido',
];

/** Estágio da geladeira: tem gatilho datado próprio, não é oportunidade em andamento. */
export const GELADEIRA = 'contato futuro';

/** Estágio do Zoho que semeia a carteira de Grandes Contas (f-040 §pedido 4). */
export const ESTAGIO_GRANDE_CONTA = 'grandes contas';

export function isGanho(stage: string): boolean {
  return ETAPAS_GANHAS.includes(norm(stage));
}

export function isPerdido(stage: string): boolean {
  return ETAPAS_PERDIDAS.includes(norm(stage));
}

export function isGrandeConta(stage: string): boolean {
  return norm(stage) === ESTAGIO_GRANDE_CONTA;
}

/** Aberto = não fechado (ganho ou perdido) e não geladeira. Estágio vazio não é aberto. */
export function isAberto(stage: string): boolean {
  const s = norm(stage);
  if (!s) return false;
  return !isGanho(s) && !isPerdido(s) && s !== GELADEIRA;
}
