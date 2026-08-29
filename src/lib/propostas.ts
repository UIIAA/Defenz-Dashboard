// Classificação de "proposta enviada" a partir do metadado do e-mail enviado.
// Spec: docs/features/feature-proposta-email-exchange.md

export interface EmailBruto {
  internetMessageId: string;
  caixa: string;
  remetente: string;
  assunto?: string;
  enviadoEm: string;
  /** to + cc */
  destinatarios: string[];
  /** só os nomes dos anexos */
  anexos: string[];
}

export type MotivoClassificacao = 'anexo' | 'assunto' | 'ambos';

export interface EmailClassificado {
  ehProposta: boolean;
  motivoClassificacao: MotivoClassificacao | null;
  /** destinatários que são o cliente: fora de casa e fora do parceiro */
  destinatariosCliente: string[];
  /** domínios dos destinatários-cliente, sem os genéricos — candidatos a chave de empresa */
  dominiosCliente: string[];
  /** 'DFZ-2026-02009' quando o anexo traz número; null nas convenções antigas */
  propostaRef: string | null;
  /** só para quase-proposta; NÃO para falta de vínculo com negócio */
  motivoRevisao: string | null;
}

const RE_PROPOSTA = /proposta/i;

/** Domínio da casa. */
const DOMINIO_INTERNO = 'defenz.com.br';

/**
 * Domínios de parceiro. O Miller (SecuriSoft) PEDE para ser copiado nas propostas — medido em
 * 25/08. Sem esta lista, toda proposta com ele em cópia contaria a SecuriSoft como cliente.
 */
const DOMINIOS_PARCEIRO = new Set(['securisoft.com.br']);

function dominioDe(endereco: string): string {
  return endereco.trim().toLowerCase().split('@')[1] ?? '';
}

/**
 * Domínios de e-mail pessoal. NUNCA viram chave de empresa — senão gmail.com vira um cliente
 * com dezenas de negócios. Medido: ~10% dos clientes atendem por endereço pessoal.
 */
const DOMINIOS_GENERICOS = new Set([
  'gmail.com',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'yahoo.com',
  'yahoo.com.br',
  'proton.me',
  'protonmail.com',
  'icloud.com',
  'bol.com.br',
  'uol.com.br',
  'terra.com.br',
]);

/** Número sequencial que a proposta ganhou a partir de 20/08/2026. */
const RE_NUMERO = /\bDFZ-\d{4}-\d{4,6}\b/i;

export const MOTIVO_QUASE_PROPOSTA = 'anexo pdf externo nao classificado';

function anexoDeProposta(anexos: string[]): boolean {
  return anexos.some((a) => /\.pdf$/i.test(a) && RE_PROPOSTA.test(a));
}

function numeroDaProposta(anexos: string[]): string | undefined {
  for (const a of anexos) {
    const m = a.match(RE_NUMERO);
    if (m) return m[0].toUpperCase();
  }
  return undefined;
}

const TZ = 'America/Sao_Paulo';

/** Dia civil em São Paulo (YYYY-MM-DD). Contar em UTC jogaria envio de fim de tarde pro dia seguinte. */
function diaSaoPaulo(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ });
}

/**
 * Quantas propostas foram enviadas. A unidade é **(cliente, dia)** — não o e-mail, não o
 * endereço e não o negócio. Ver §Identidade da spec.
 *
 * "Cliente" é o DOMÍNIO quando ele identifica uma empresa, e o endereço quando o domínio é
 * genérico (duas pessoas em gmail.com são dois clientes; duas pessoas em @fiorilli.com.br são
 * o mesmo). Cinco casos medidos que essa chave resolve:
 *   LDV Net .......... 3 PDFs num e-mail ................... 1
 *   Agroserra ........ mesmo arquivo em 19 e 24/08 ......... 2
 *   Fac. Baiana ...... 2 vendedores, mesmo dia ............. 1
 *   Fiorilli ......... 2 endereços do mesmo contato ........ 1
 *   Rebouças ......... 2 pessoas da mesma empresa .......... 1
 */
export function contarPropostas(emails: EmailBruto[]): number {
  const chaves = new Set<string>();
  for (const e of emails) {
    const c = classificarEmail(e);
    if (!c.ehProposta) continue;
    const dia = diaSaoPaulo(e.enviadoEm);
    for (const cliente of clientesDe(c)) chaves.add(`${cliente}|${dia}`);
  }
  return chaves.size;
}

/** Identidade do cliente: domínio quando é empresa, endereço quando o domínio é genérico. */
function clientesDe(c: EmailClassificado): string[] {
  const ids = c.destinatariosCliente.map((d) => {
    const dom = dominioDe(d);
    return DOMINIOS_GENERICOS.has(dom) ? d.trim().toLowerCase() : dom;
  });
  return Array.from(new Set(ids));
}

export function classificarEmail(e: EmailBruto): EmailClassificado {
  const destinatariosCliente = e.destinatarios.filter((d) => {
    const dom = dominioDe(d);
    return dom !== '' && dom !== DOMINIO_INTERNO && !DOMINIOS_PARCEIRO.has(dom);
  });

  const dominiosCliente = Array.from(
    new Set(destinatariosCliente.map(dominioDe).filter((d) => !DOMINIOS_GENERICOS.has(d))),
  );

  const porAnexo = anexoDeProposta(e.anexos);
  const porAssunto = RE_PROPOSTA.test(e.assunto ?? '');
  const ehProposta = (porAnexo || porAssunto) && destinatariosCliente.length > 0;

  const pdfExterno = destinatariosCliente.length > 0 && e.anexos.some((a) => /\.pdf$/i.test(a));

  return {
    ehProposta,
    destinatariosCliente,
    dominiosCliente,
    propostaRef: ehProposta ? (numeroDaProposta(e.anexos) ?? null) : null,
    motivoRevisao: !ehProposta && pdfExterno ? MOTIVO_QUASE_PROPOSTA : null,
    motivoClassificacao: !ehProposta
      ? null
      : porAnexo && porAssunto
        ? 'ambos'
        : porAnexo
          ? 'anexo'
          : 'assunto',
  };
}
