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

const POR_ID: Record<string, string> = {
  '7067822000000576001': 'Leonardo', // "vendor 2" / suporte@defenz.com.br
  '7067822000000743027': 'Gustavo F', // "Gustavo Figueira" / gustavo@defenz.com.br
};

export const SEM_DONO = 'sem dono';

/**
 * Id desconhecido cai para o nome cru do Zoho, NÃO para 'sem dono': um vendedor novo tem que
 * aparecer com o nome dele na tela no primeiro dia, mesmo antes de alguém lembrar de vir aqui
 * adicionar o id. Só a ausência total de dono vira 'sem dono'.
 */
export function nomeDono(ownerId: unknown, ownerNome: unknown): string {
  const id = String(ownerId ?? '').trim();
  if (id && POR_ID[id]) return POR_ID[id];
  const nome = String(ownerNome ?? '').trim();
  return nome || SEM_DONO;
}
