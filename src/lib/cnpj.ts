// feature-cnpj-identidade-empresa — CNPJ como identidade de empresa.
//
// O campo `CNPJ` no Zoho é TEXTO LIVRE: medido em 01/08/2026, um deal traz a palavra
// "Localizando" e outro um CNPJ truncado ("29.554.953/0001"). Por isso a única porta de
// entrada aqui é o dígito verificador — não há saneamento nem lista de exceções.
//
// `CNPJ1` é resíduo na maioria dos casos (6 de 7 são cópia idêntica do `CNPJ`), mas no
// sétimo ele carrega o valor real justamente quando o campo principal tem lixo. Serve
// como FALLBACK — nunca como segunda identidade, nunca para unir duas empresas.

const PESOS_12 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const PESOS_13 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

export function somenteDigitos(valor: unknown): string {
  return String(valor ?? '').replace(/\D/g, '');
}

function digitoVerificador(base: string): number {
  const pesos = base.length === 12 ? PESOS_12 : PESOS_13;
  let soma = 0;
  for (let i = 0; i < base.length; i++) soma += Number(base[i]) * pesos[i];
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

/** true só para 14 dígitos com dígito verificador correto. Rejeita texto e repetições. */
export function cnpjValido(valor: unknown): boolean {
  const c = somenteDigitos(valor);
  if (c.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(c)) return false;
  return (
    Number(c[12]) === digitoVerificador(c.slice(0, 12)) &&
    Number(c[13]) === digitoVerificador(c.slice(0, 13))
  );
}

/** Primeiro CNPJ válido entre os campos, na ordem. '' quando nenhum passa. */
export function cnpjCanonico(...campos: unknown[]): string {
  for (const campo of campos) {
    const c = somenteDigitos(campo);
    if (cnpjValido(c)) return c;
  }
  return '';
}

/** 14 dígitos → 00.000.000/0000-00. Devolve '' se não for válido. */
export function formatarCnpj(valor: unknown): string {
  const c = somenteDigitos(valor);
  if (!cnpjValido(c)) return '';
  return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`;
}

// Sufixos societários e ruído que não distinguem empresa. Só entram no fallback por nome —
// o CNPJ dispensa isso inteiro.
const RUIDO_RAZAO_SOCIAL =
  /\b(s\/a|s\.a\.?|sa|ltda|me|epp|eireli|cia|em recupera(c|ç)(a|ã)o( judicial)?)\b/g;

export function normalizarNomeEmpresa(nome: unknown): string {
  return String(nome ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(RUIDO_RAZAO_SOCIAL, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Identidade da empresa para agrupamento. CNPJ quando existe (87% dos deals, 99% dos
 * ganhos); senão o nome normalizado. O prefixo evita que um nome que por acaso seja
 * numérico colida com um CNPJ.
 */
export function identidadeEmpresa(deal: { cnpj?: unknown; empresa?: unknown; nome?: unknown }): string {
  const cnpj = cnpjCanonico(deal.cnpj);
  if (cnpj) return `cnpj:${cnpj}`;
  const nome = normalizarNomeEmpresa(deal.empresa) || normalizarNomeEmpresa(deal.nome);
  return nome ? `nome:${nome}` : 'nome:—';
}
