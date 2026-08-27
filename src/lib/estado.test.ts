import { describe, it, expect } from 'vitest';
import {
  ESTADOS,
  POSSE_TITULO,
  ORDEM_POSSE,
  EM_VALIDACAO,
  JANELA_DIAS,
  normalizaEstado,
  posseDe,
  diasParaVencer,
  naJanela,
  ordemGrupo,
  mesAno,
  montaFicha,
} from './estado';

// feature-038. A régua de LEITURA (as 6 regras da §3 da spec) é do modelo e mora no runbook;
// aqui só entra o que é determinístico. Ver comentário no topo de estado.ts.

describe('os 11 estados', () => {
  it('são exatamente 11 e todos têm posse', () => {
    expect(ESTADOS).toHaveLength(11);
    for (const e of ESTADOS) expect(['nossa', 'cliente', 'parado']).toContain(posseDe(e));
  });

  it('mapeia cada estado para a posse da tabela da §3 da spec', () => {
    expect(posseDe('Mapeamento de decisor')).toBe('nossa');
    expect(posseDe('Reunião a agendar')).toBe('nossa');
    expect(posseDe('Contato sem retorno')).toBe('parado');
    expect(posseDe('Bloqueio declarado')).toBe('parado');
    expect(posseDe('Reunião agendada')).toBe('cliente');
    expect(posseDe('Retorno agendado')).toBe('cliente');
    expect(posseDe('Proposta em análise')).toBe('cliente');
    expect(posseDe('Aguardando aprovação interna')).toBe('cliente');
    expect(posseDe('Em negociação comercial')).toBe('cliente');
    expect(posseDe('Prova de conceito')).toBe('cliente');
    expect(posseDe('Fechamento em curso')).toBe('cliente');
  });

  it('só 2 dos 11 são "parado", e são os dois que pedem ação oposta ao resto', () => {
    const parados = ESTADOS.filter((e) => posseDe(e) === 'parado');
    expect(parados).toEqual(['Contato sem retorno', 'Bloqueio declarado']);
  });
});

describe('normalizaEstado', () => {
  it('aceita o valor exato do picklist', () => {
    expect(normalizaEstado('Bloqueio declarado')).toBe('Bloqueio declarado');
  });

  it('tolera acento, caixa e espaço a mais, que é o que volta do Zoho na prática', () => {
    expect(normalizaEstado('bloqueio  DECLARADO ')).toBe('Bloqueio declarado');
    expect(normalizaEstado('REUNIAO A AGENDAR')).toBe('Reunião a agendar');
    expect(normalizaEstado('proposta em analise')).toBe('Proposta em análise');
  });

  it('valor fora da lista vira vazio, NÃO erro', () => {
    // Um valor novo no picklist do Zoho não pode derrubar a tela. Mesmo tratamento da
    // temperatura: desconhecido = não classificado, e o cabeçalho cobra.
    expect(normalizaEstado('Estado que alguem inventou')).toBe('');
    expect(normalizaEstado('-None-')).toBe('');
    expect(normalizaEstado('')).toBe('');
    expect(normalizaEstado(null)).toBe('');
    expect(normalizaEstado(undefined)).toBe('');
    expect(posseDe('')).toBe('');
  });
});

describe('janela dos 90 dias', () => {
  const hoje = '2026-08-27';

  it('conta os dias corridos até o vencimento', () => {
    expect(diasParaVencer('2026-08-27', hoje)).toBe(0);
    expect(diasParaVencer('2026-09-01', hoje)).toBe(5);
    expect(diasParaVencer('2026-11-25', hoje)).toBe(JANELA_DIAS);
  });

  it('inclui a data exata do 90º dia e exclui o 91º', () => {
    expect(naJanela(diasParaVencer('2026-11-25', hoje))).toBe(true);
    expect(naJanela(diasParaVencer('2026-11-26', hoje))).toBe(false);
  });

  it('licença JÁ VENCIDA conta como dentro da janela', () => {
    // Decisão registrada em estado.ts: vencida é mais urgente, não menos. Hoje não muda
    // número (o vencimento mais próximo do pipe é 01/09/2026), muda no primeiro atrasado.
    expect(diasParaVencer('2026-07-01', hoje)).toBe(-57);
    expect(naJanela(-57)).toBe(true);
  });

  it('sem data não está na janela, e não explode', () => {
    expect(diasParaVencer(null, hoje)).toBeNull();
    expect(diasParaVencer('nov/2026', hoje)).toBeNull();
    expect(diasParaVencer('', hoje)).toBeNull();
    expect(naJanela(null)).toBe(false);
  });

  it('atravessa a virada do ano sem erro de fuso', () => {
    expect(diasParaVencer('2027-01-01', '2026-12-31')).toBe(1);
    expect(diasParaVencer('2026-03-01', '2026-02-28')).toBe(1); // 2026 não é bissexto
  });

  it('reproduz a janela real do pipe em 27/08/2026', () => {
    // Os 6 cards com `Vencimeno_da_licen_a` preenchido dentro de 90 dias, medidos no Zoho.
    const campo = [
      ['Wintress', '2026-09-01'],
      ['HM Engenharia', '2026-09-01'],
      ['LOCALIZADORA', '2026-10-01'],
      ['ABGF', '2026-11-01'],
      ['FIORILLI', '2026-11-02'],
      ['Abi-Ackel', '2026-11-16'],
      ['Norte Energia', '2026-12-01'],
      ['PREFEITURA DE CASCA', '2026-12-01'],
      ['Precision', '2027-01-01'],
      ['Tabelionato', '2027-01-01'],
      ["L'AUTO CARGO", '2027-02-01'],
    ] as const;
    const dentro = campo.filter(([, v]) => naJanela(diasParaVencer(v, hoje))).map(([n]) => n);
    expect(dentro).toEqual([
      'Wintress',
      'HM Engenharia',
      'LOCALIZADORA',
      'ABGF',
      'FIORILLI',
      'Abi-Ackel',
    ]);
  });
});

describe('ordem dos grupos na tela', () => {
  it('parado vem primeiro, cliente por último (§5 da spec)', () => {
    expect(ORDEM_POSSE).toEqual(['parado', 'nossa', 'cliente']);
    expect(ordemGrupo('parado')).toBeLessThan(ordemGrupo('nossa'));
    expect(ordemGrupo('nossa')).toBeLessThan(ordemGrupo('cliente'));
  });

  it('card sem estado vai para o FIM, não para o começo', () => {
    // Ao contrário da temperatura, que põe o não classificado no topo para cobrar. Aqui o
    // bucket nasce com os 68 cards e enterraria os R$ 93 mil de "parado", que é o motivo da
    // tela existir. A cobrança fica no contador do cabeçalho.
    expect(ordemGrupo('')).toBeGreaterThan(ordemGrupo('cliente'));
  });

  it('todo grupo tem título', () => {
    for (const p of ORDEM_POSSE) expect(POSSE_TITULO[p]).toBeTruthy();
  });
});

describe('ficha do ambiente', () => {
  it('nulo vira "em validação" ROTULADO, nunca branco', () => {
    // Sem rótulo, um card sem nenhum dado vira 'em validação · em validação · em validação'
    // na linha e ninguém sabe o que está faltando.
    const f = montaFicha(0, null, null);
    expect(f).toEqual({
      licencas: `lic. ${EM_VALIDACAO}`,
      antivirus: `AV ${EM_VALIDACAO}`,
      vencimento: `venc. ${EM_VALIDACAO}`,
    });
  });

  it('branco e espaço em branco também viram "em validação"', () => {
    expect(montaFicha(0, '   ', '').antivirus).toBe(`AV ${EM_VALIDACAO}`);
  });

  it('formata o vencimento como mês/ano, que é a granularidade que decide', () => {
    expect(mesAno('2026-11-02')).toBe('nov/2026');
    expect(mesAno('2027-01-01')).toBe('jan/2027');
    expect(mesAno('2026-09-01')).toBe('set/2026');
  });

  it('data torta não vira data inventada', () => {
    expect(mesAno('nov/2026')).toBe(EM_VALIDACAO);
    // Formato batendo não é data existindo: mês 13 indexava fora do array e imprimia
    // 'undefined/2026' na tela. Foi este teste que pegou.
    expect(mesAno('2026-13-01')).toBe(EM_VALIDACAO);
    expect(mesAno('2026-02-30')).toBe(EM_VALIDACAO);
    expect(diasParaVencer('2026-13-01', '2026-08-27')).toBeNull();
  });

  it('monta a ficha completa de um card real (Abi-Ackel, §6 da spec)', () => {
    expect(montaFicha(180, 'Bitdefender', '2026-11-16')).toEqual({
      licencas: '180 lic',
      antivirus: 'Bitdefender',
      vencimento: 'nov/2026',
    });
  });
});
