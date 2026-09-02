// Dono do negócio — quem aparece na tela no lugar do nome cru do Zoho.
//
// POR QUE MAPEAR POR ID E NÃO POR NOME: o nome de exibição do usuário no Zoho é editável, e
// os dois nomes de hoje já mostram o problema. `vendor 2` não é o nome de ninguém, é uma conta
// genérica (suporte@defenz.com.br) que na prática é o Leonardo; e `Gustavo Figueira` é longo
// demais para caber na linha do card. Amarrar no id (`Owner.id`) faz a tela sobreviver a uma
// renomeação lá dentro.
//
// Medido em 27/08/2026: existem exatamente DOIS donos nos 299 negócios do Zoho.
//   vendor 2         · 121 negócios (52 no pipe aberto) · suporte@defenz.com.br
//   Gustavo Figueira · 178 negócios (16 no pipe aberto) · gustavo@defenz.com.br

/** Conta genérica `suporte@defenz.com.br`. Duas pessoas usam ela — ver abaixo. */
const CONTA_COMPARTILHADA = '7067822000000576001';

const POR_ID: Record<string, string> = {
  [CONTA_COMPARTILHADA]: 'Leonardo', // "vendor 2" / suporte@defenz.com.br
  '7067822000000743027': 'Gustavo F', // "Gustavo Figueira" / gustavo@defenz.com.br
};

/**
 * feature-040 §pedido 4 — DOIS nomes para o MESMO `owner_id`, e isso é de propósito.
 *
 * As 39 Grandes Contas foram criadas por carga de lista sob a conta compartilhada. Elas são a
 * carteira do FRANCISCO; o resto dos negócios daquela conta é do Leonardo. Como o `owner_id` é
 * o mesmo nos dois casos, ele não separa — quem separa é a marca de Grande Conta.
 *
 * O Marcos decidiu em 02/09 (D-3) que não haverá reatribuição no Zoho: os dois dividem a conta.
 * A sessão Chief recomendou o contrário (arrumar o dono na origem) e foi recusada.
 *
 * ⚠️ CONDIÇÃO DE REMOÇÃO (f-040 R4.1): no dia em que o Francisco tiver usuário próprio no Zoho
 * e os negócios forem reatribuídos, ESTA REGRA SAI. Sem isso ela vira mentira permanente.
 */
const DONO_GRANDE_CONTA_COMPARTILHADA = 'Francisco';

export const SEM_DONO = 'sem dono';

/**
 * Id desconhecido cai para o nome cru do Zoho, NÃO para 'sem dono': um vendedor novo tem que
 * aparecer com o nome dele na tela no primeiro dia, mesmo antes de alguém lembrar de vir aqui
 * adicionar o id. Só a ausência total de dono vira 'sem dono'.
 */
export function nomeDono(
  ownerId: unknown,
  ownerNome: unknown,
  grandeConta: boolean = false
): string {
  const id = String(ownerId ?? '').trim();
  // A marca só desempata DENTRO da conta compartilhada. Negócio de outro dono que vire Grande
  // Conta continua do dono dele — a carteira não sequestra a autoria.
  if (grandeConta && id === CONTA_COMPARTILHADA) return DONO_GRANDE_CONTA_COMPARTILHADA;
  if (id && POR_ID[id]) return POR_ID[id];
  const nome = String(ownerNome ?? '').trim();
  return nome || SEM_DONO;
}
