import { describe, it, expect } from 'vitest';
import { classificarEmail, contarPropostas } from './propostas';

function email(over: Partial<Parameters<typeof classificarEmail>[0]> = {}) {
  return {
    internetMessageId: '<x@defenz>',
    caixa: 'gustavo@defenz.com.br',
    remetente: 'gustavo@defenz.com.br',
    assunto: 'Proposta Bitdefender',
    enviadoEm: '2026-08-19T14:00:00Z',
    destinatarios: ['cliente@exemplo.com.br'],
    anexos: ['Proposta.pdf'],
    ...over,
  };
}

// Todos os casos deste arquivo foram MEDIDOS nas caixas do time em 27/08/2026.
// Spec: docs/features/feature-proposta-email-exchange.md

describe('classificarEmail', () => {
  it('pega a proposta cujo assunto diz "Apresentação" — só o anexo denuncia', () => {
    // Medido 27/08, Alvorada do Sul. Regra só por assunto perderia esta.
    const r = classificarEmail({
      internetMessageId: '<a@defenz>',
      caixa: 'gustavo@defenz.com.br',
      remetente: 'gustavo@defenz.com.br',
      assunto: 'RE: Apresentação Bitdefender GravityZone | Defenz',
      enviadoEm: '2026-08-27T18:46:27Z',
      destinatarios: ['suporte@alvoradadosul.pr.gov.br'],
      anexos: ['imagem (1).png', 'Proposta Defenz DFZ-2026-02009.pdf'],
    });

    expect(r.ehProposta).toBe(true);
    expect(r.motivoClassificacao).toBe('anexo');
  });

  it('pega a proposta cujo anexo se chama "apresentacao" — só o assunto denuncia', () => {
    // Medido 14/08, Barbosa Mello. Regra só por anexo perderia esta.
    const r = classificarEmail({
      internetMessageId: '<b@defenz>',
      caixa: 'GustavoBarbosa@defenz.com.br',
      remetente: 'gustavobarbosa@defenz.com.br',
      assunto: 'Proposta Bitdefender GravityZone - Proteção Completa  | Barbosa Mello',
      enviadoEm: '2026-08-14T14:41:36Z',
      destinatarios: ['daniel.franco@cbmsa.com.br'],
      anexos: ['image.png', 'apresentacao-Barbosa-Mello.pdf'],
    });

    expect(r.ehProposta).toBe(true);
    expect(r.motivoClassificacao).toBe('assunto');
  });

  it('encaminhamento interno com anexo de proposta NÃO conta', () => {
    // Medido: 2 dos 11 candidatos do Leonardo em agosto eram ENC pro Gustavo.
    const r = classificarEmail({
      internetMessageId: '<c@defenz>',
      caixa: 'leonardoalves@defenz.com.br',
      remetente: 'leonardoalves@defenz.com.br',
      assunto: 'ENC: PROPOSTA COMERCIAL BITDEFENDER',
      enviadoEm: '2026-08-11T12:00:00Z',
      destinatarios: ['gustavo@DEFENZ.COM.BR'],
      anexos: ['Proposta_Comercial_Rodrigo_Mendes.pdf'],
    });

    expect(r.ehProposta).toBe(false);
    expect(r.destinatariosCliente).toEqual([]);
  });

  it('o Miller em cópia não vira cliente — domínio de parceiro sai da conta', () => {
    // Medido 25/08: o Miller PEDE para ser copiado na proposta. Se securisoft contasse
    // como destinatário externo, toda proposta com ele em cópia contaria a SecuriSoft
    // como se ela fosse o cliente.
    const r = classificarEmail({
      internetMessageId: '<d@defenz>',
      caixa: 'gustavo@defenz.com.br',
      remetente: 'gustavo@defenz.com.br',
      assunto: 'Renovação Bitdefender GravityZone | Abi-Ackel Advogados',
      enviadoEm: '2026-08-25T14:00:00Z',
      destinatarios: [
        'joana.ferraz@abiackeladvogados.com.br',
        'miller.nogueira@securisoft.com.br',
        'marcos@DEFENZ.COM.BR',
      ],
      anexos: ['Proposta Defenz DFZ-2026-02001.pdf'],
    });

    expect(r.ehProposta).toBe(true);
    expect(r.destinatariosCliente).toEqual(['joana.ferraz@abiackeladvogados.com.br']);
  });
});

describe('contarPropostas — chave (destinatário cliente, dia)', () => {
  it('LDV Net: 3 PDFs numerados num e-mail só contam 1', () => {
    // Medido 21/08 — três opções de plano na mesma mensagem. Decisão do Marcos: 1.
    const n = contarPropostas([
      email({
        internetMessageId: '<ldv@defenz>',
        enviadoEm: '2026-08-21T20:02:24Z',
        destinatarios: ['danilo@ldvnet.com.br'],
        anexos: [
          'Proposta Defenz DFZ-2026-01993.pdf',
          'Proposta Defenz DFZ-2026-01994.pdf',
          'Proposta Defenz DFZ-2026-01995.pdf',
        ],
      }),
    ]);

    expect(n).toBe(1);
  });

  it('Agroserra: mesmo arquivo em 19 e 24/08 conta 2 — uma por dia', () => {
    // Decisão do Marcos: reenvio com dias de intervalo é atualização de proposta.
    const n = contarPropostas([
      email({
        internetMessageId: '<agro1@defenz>',
        enviadoEm: '2026-08-19T17:08:17Z',
        destinatarios: ['bianca@agroserramaquinas.com.br'],
        anexos: ['Proposta-Agroserra.pdf'],
      }),
      email({
        internetMessageId: '<agro2@defenz>',
        enviadoEm: '2026-08-24T14:15:39Z',
        destinatarios: ['bianca@agroserramaquinas.com.br'],
        anexos: ['Proposta-Agroserra.pdf'],
      }),
    ]);

    expect(n).toBe(2);
  });

  it('Faculdade Baiana: dois vendedores, mesmo cliente, mesmo dia contam 1', () => {
    // Medido 25/08: Barbosa e Leonardo mandaram arquivos DIFERENTES pro mesmo destinatário.
    const n = contarPropostas([
      email({
        internetMessageId: '<baiana-b@defenz>',
        caixa: 'GustavoBarbosa@defenz.com.br',
        remetente: 'gustavobarbosa@defenz.com.br',
        enviadoEm: '2026-08-25T14:35:32Z',
        destinatarios: ['tibaiana@faculdadebaianadedireito.com.br'],
        anexos: ['Proposta-Faculdade-Baiana-de-Direito.pdf'],
      }),
      email({
        internetMessageId: '<baiana-l@defenz>',
        caixa: 'leonardoalves@defenz.com.br',
        remetente: 'leonardoalves@defenz.com.br',
        enviadoEm: '2026-08-25T17:14:20Z',
        destinatarios: ['tibaiana@faculdadebaianadedireito.com.br'],
        anexos: ['Proposta Defenz DFZ-2026-02002.pdf'],
      }),
    ]);

    expect(n).toBe(1);
  });

  it('o dia é o de São Paulo, não o UTC', () => {
    // 27/08 00:30 UTC é ainda 26/08 21:30 em SP. Contar em UTC jogaria a proposta
    // para o dia seguinte e furaria o número diário.
    const n = contarPropostas([
      email({
        internetMessageId: '<tz1@defenz>',
        enviadoEm: '2026-08-26T23:00:00Z', // 26/08 20:00 SP
        destinatarios: ['cliente@exemplo.com.br'],
      }),
      email({
        internetMessageId: '<tz2@defenz>',
        enviadoEm: '2026-08-27T00:30:00Z', // 26/08 21:30 SP — mesmo dia
        destinatarios: ['cliente@exemplo.com.br'],
      }),
    ]);

    expect(n).toBe(1);
  });

  it('e-mail que não é proposta não entra na conta', () => {
    const n = contarPropostas([
      email({
        internetMessageId: '<ata@defenz>',
        assunto: 'Ata de Reunião Pipeline Review - Defenz - 27/08/2026',
        anexos: ['ata.pdf'],
      }),
    ]);

    expect(n).toBe(0);
  });
});

describe('sinais auxiliares', () => {
  it('extrai o número DFZ do nome do anexo — identidade exata quando existe', () => {
    const r = classificarEmail(email({ anexos: ['Proposta Defenz DFZ-2026-02009.pdf'] }));
    expect(r.propostaRef).toBe('DFZ-2026-02009');
  });

  it('proposta sem número (convenção antiga) não inventa ref', () => {
    // Até 19/08 os arquivos não tinham número; o Barbosa não usa nenhum.
    const r = classificarEmail(email({ anexos: ['Proposta-Agroserra.pdf'] }));
    expect(r.ehProposta).toBe(true);
    expect(r.propostaRef).toBeNull();
  });

  it('PDF externo que não casou a regra vira quase-proposta, não sumiço', () => {
    // Guarda nº 1 da spec: é assim que a PRÓXIMA mudança de convenção de nome aparece
    // antes de virar buraco na métrica.
    const r = classificarEmail(
      email({ assunto: 'Bitdefender | Eduardo Ferrão', anexos: ['orcamento-2026.pdf'] }),
    );
    expect(r.ehProposta).toBe(false);
    expect(r.motivoRevisao).toBe('anexo pdf externo nao classificado');
  });

  it('domínio genérico nunca vira chave de empresa, mas o destinatário conta', () => {
    // Medido: ~10% dos clientes atendem por e-mail pessoal. gmail.com não pode virar
    // uma empresa com 40 negócios — mas a proposta foi enviada e tem que contar.
    const r = classificarEmail(
      email({ destinatarios: ['rafael1.advmarques@gmail.com'] }),
    );
    expect(r.ehProposta).toBe(true);
    expect(r.destinatariosCliente).toEqual(['rafael1.advmarques@gmail.com']);
    expect(r.dominiosCliente).toEqual([]);
  });
});

describe('contarPropostas — a chave é a EMPRESA, não o endereço', () => {
  it('Fiorilli: mesma proposta pra dois endereços do mesmo contato conta 1', () => {
    // Medido 26/08: DFZ-2026-02004 saiu para eduardogalli@ e eduardo.galli@, 5 min de
    // diferença. Chave por endereço contaria 2.
    const n = contarPropostas([
      email({
        internetMessageId: '<fio1@defenz>',
        enviadoEm: '2026-08-26T20:24:43Z',
        destinatarios: ['eduardogalli@fiorilli.com.br'],
        anexos: ['Proposta Defenz DFZ-2026-02004.pdf'],
      }),
      email({
        internetMessageId: '<fio2@defenz>',
        enviadoEm: '2026-08-26T20:29:53Z',
        destinatarios: ['eduardo.galli@fiorilli.com.br'],
        anexos: ['Proposta Defenz DFZ-2026-02004.pdf'],
      }),
    ]);

    expect(n).toBe(1);
  });

  it('Rebouças: mesma proposta pra duas pessoas da mesma empresa conta 1', () => {
    // Medido 14/08, Leonardo: mesmo PDF para James@ e Jamerson@, sem número.
    const n = contarPropostas([
      email({
        internetMessageId: '<reb1@defenz>',
        enviadoEm: '2026-08-14T12:00:00Z',
        destinatarios: ['James@reboucassupermercados.com.br'],
        anexos: ['Proposta_Comercial_REBOUCASSUPERMERCADOS.pdf'],
      }),
      email({
        internetMessageId: '<reb2@defenz>',
        enviadoEm: '2026-08-14T15:00:00Z',
        destinatarios: ['Jamerson@reboucassupermercados.com.br'],
        anexos: ['Proposta_Comercial_REBOUCASSUPERMERCADOS.pdf'],
      }),
    ]);

    expect(n).toBe(1);
  });

  it('dois clientes em e-mail pessoal continuam sendo dois', () => {
    // gmail.com não é empresa: aqui a chave TEM que cair no endereço.
    const n = contarPropostas([
      email({ internetMessageId: '<g1@defenz>', destinatarios: ['um@gmail.com'] }),
      email({ internetMessageId: '<g2@defenz>', destinatarios: ['outro@gmail.com'] }),
    ]);

    expect(n).toBe(2);
  });
});
