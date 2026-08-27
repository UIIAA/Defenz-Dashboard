import { describe, it, expect } from 'vitest';
import {
  formatarDeals, classifyOrigin, cnpjCanonico, caudaResultados, normalizaTemperatura, toStr,
} from './format-deals-raw.mjs';

const pagina = (deals) => [{ json: { data: deals, info: { more_records: false } } }];

describe('classifyOrigin — decide a comissão da Defenz', () => {
  it('Securisoft paga 5%', () => {
    expect(classifyOrigin('Parceiro SS ( SecuriSoft )')).toEqual({ categoria: 'securisoft', taxa: 0.05 });
    expect(classifyOrigin('SecuriSoft')).toEqual({ categoria: 'securisoft', taxa: 0.05 });
  });

  it('"parceiro ss" ganha de "parceiro" — a ORDEM das regras é a regra', () => {
    // Se o teste de `parceiro` viesse antes, todo negócio da SecuriSoft pagaria 43% em vez de
    // 5%: 8,6x a comissão devida. É por isso que este caso existe.
    expect(classifyOrigin('Parceiro SS').categoria).toBe('securisoft');
    expect(classifyOrigin('Parceiro Fulano').categoria).toBe('parceiro');
  });

  it('canais diretos pagam 58%', () => {
    for (const s of ['Apollo', 'LinkedIn', 'Cold Call', 'Chamada Surpresa']) {
      expect(classifyOrigin(s)).toEqual({ categoria: 'direto', taxa: 0.58 });
    }
  });

  it('origem desconhecida, vazia ou nula cai em direto/58%', () => {
    for (const s of ['qualquer outra coisa', '', null, undefined]) {
      expect(classifyOrigin(s)).toEqual({ categoria: 'direto', taxa: 0.58 });
    }
  });

  it('não depende de caixa nem de espaço nas pontas', () => {
    expect(classifyOrigin('   COLD CALL  ').categoria).toBe('direto');
    expect(classifyOrigin('  securisoft ').categoria).toBe('securisoft');
  });
});

describe('cnpjCanonico — o campo do Zoho é texto livre', () => {
  it('formata CNPJ válido e preserva zero à esquerda', () => {
    // Emitido FORMATADO de propósito: '10843079000176' cru viraria número no Sheets e perderia
    // o zero da frente.
    expect(cnpjCanonico('10843079000176')).toBe('10.843.079/0001-76');
    expect(cnpjCanonico('10.843.079/0001-76')).toBe('10.843.079/0001-76');
  });

  it('recusa lixo: palavra, truncado, dígito verificador errado, repetido', () => {
    for (const c of ['Localizando', '1084307900', '10843079000177', '11111111111111', '', null]) {
      expect(cnpjCanonico(c)).toBe('');
    }
  });

  it('cai para o segundo campo quando o primeiro tem lixo', () => {
    expect(cnpjCanonico('Localizando', '10843079000176')).toBe('10.843.079/0001-76');
  });

  it('o primeiro campo válido vence — CNPJ1 é fallback, não segunda identidade', () => {
    expect(cnpjCanonico('10843079000176', '11222333000181')).toBe('10.843.079/0001-76');
  });
});

describe('caudaResultados — guarda o FIM, cortando na quebra de linha', () => {
  it('texto curto passa inteiro', () => {
    expect(caudaResultados('27/08 - ligou [PROPOSTA]')).toBe('27/08 - ligou [PROPOSTA]');
  });

  it('guarda o histórico RECENTE, não o antigo', () => {
    // O bug original fazia slice(0,1000): guardava os 1000 chars mais ANTIGOS e descartava o
    // andamento recente. Medido: 125 de 260 negócios truncados, média de 33 dias invisíveis.
    const antigo = '01/01 - primeiro contato\n'.repeat(300);
    const r = caudaResultados(antigo + '27/08 - fechou [PROPOSTA]');
    expect(r).toContain('27/08 - fechou [PROPOSTA]');
    expect(r.length).toBeLessThanOrEqual(4000);
  });

  it('nunca corta no meio de uma linha', () => {
    // Cortar no char decapita a data e PRESERVA a tag: o parser pega o primeiro DD/MM da linha,
    // então emitiria data pescada de outro número da linha.
    const r = caudaResultados('x'.repeat(5000) + '\n15/08 - reuniao [REUNIAO]\n20/08 - ok');
    expect(r).toBe('15/08 - reuniao [REUNIAO]\n20/08 - ok');
    expect(r.startsWith('x')).toBe(false);
  });

  it('sem nenhuma quebra de linha, cai para os últimos 4000 chars', () => {
    const r = caudaResultados('a'.repeat(4500) + 'FIM');
    expect(r.length).toBe(4000);
    expect(r.endsWith('FIM')).toBe(true);
  });
});

describe('normalizaTemperatura', () => {
  it('aceita as três e ignora caixa, acento e espaço', () => {
    expect(normalizaTemperatura('Quente')).toBe('quente');
    expect(normalizaTemperatura('  MORNO ')).toBe('morno');
    expect(normalizaTemperatura('frío')).toBe('frio');
  });

  it('valor desconhecido, "-None-" e vazio viram string vazia (cinza na tela)', () => {
    for (const v of ['-None-', 'tépido', '', null, undefined]) {
      expect(normalizaTemperatura(v)).toBe('');
    }
  });
});

describe('toStr', () => {
  it('objeto do Zoho vira o nome', () => {
    expect(toStr({ id: '123', name: 'Gustavo Figueira' })).toBe('Gustavo Figueira');
  });

  it('nulo vira vazio e número vira texto', () => {
    expect(toStr(null)).toBe('');
    expect(toStr(undefined)).toBe('');
    expect(toStr(42)).toBe('42');
  });
});

describe('formatarDeals', () => {
  const base = {
    id: '700', Deal_Name: 'Negócio X', Account_Name: { name: 'ACME' }, Stage: 'Proposta Enviada',
    Amount: 10000, Lead_Source: 'Apollo', Created_Time: '2026-08-01T10:00:00-03:00',
    Modified_Time: '2026-08-20T10:00:00-03:00', Closing_Date: '2026-09-30',
    Resultados: '20/08 - ok', Temperatura: 'Quente', N_de_Endpoints: '50',
    Vencimeno_da_licen_a: '2026-12-31', CNPJ: '10843079000176',
  };

  it('mapeia um negócio inteiro', () => {
    const [d] = formatarDeals(pagina([base]));
    expect(d).toEqual({
      id: '700', nome: 'Negócio X', empresa: 'ACME', cnpj: '10.843.079/0001-76',
      stage: 'Proposta Enviada', valor: 10000, lead_source: 'Apollo', categoria: 'direto',
      comissao_valor: 5800, created_time: '2026-08-01', modified_time: '2026-08-20',
      closing_date: '2026-09-30', resultados: '20/08 - ok', temperatura: 'quente',
      tags: '', licencas: 50, vencimento_licenca: '2026-12-31',
    });
  });

  it('comissão é arredondada, não truncada', () => {
    const [d] = formatarDeals(pagina([{ ...base, Amount: 1001, Lead_Source: 'Parceiro Fulano' }]));
    expect(d.comissao_valor).toBe(Math.round(1001 * 0.43)); // 430, não 430.43 nem 430.0
  });

  it('Amount vazio ou não numérico vira 0 — não NaN', () => {
    // Um ganho com valor 0 no Farol significa Amount vazio no Zoho, não erro de código.
    for (const a of [null, undefined, '', 'abc']) {
      expect(formatarDeals(pagina([{ ...base, Amount: a }]))[0].valor).toBe(0);
    }
  });

  it('junta as tags e ignora as sem nome', () => {
    const [d] = formatarDeals(pagina([{ ...base, Tag: [{ name: 'renovacao' }, {}, { name: 'q3' }] }]));
    expect(d.tags).toBe('renovacao, q3');
  });

  it('licencas não numérico vira 0', () => {
    expect(formatarDeals(pagina([{ ...base, N_de_Endpoints: null }]))[0].licencas).toBe(0);
  });

  it('junta as páginas todas', () => {
    const duas = [
      { json: { data: [base, base] } },
      { json: { data: [{ ...base, id: '701' }] } },
    ];
    expect(formatarDeals(duas).map((d) => d.id)).toEqual(['700', '700', '701']);
  });

  it('SEM SENTINELA: payload vazio devolve lista vazia, nunca linha "Sem dados"', () => {
    // A sentinela `id: 'none'` foi morta em 27/08/2026. Ela nunca disparou em produção e, se
    // disparasse, gravaria uma linha-lixo na planilha e no Neon para alguém limpar à mão.
    expect(formatarDeals([])).toEqual([]);
    expect(formatarDeals([{ json: {} }])).toEqual([]);
    expect(formatarDeals([{ json: { data: [] } }])).toEqual([]);
  });
});
