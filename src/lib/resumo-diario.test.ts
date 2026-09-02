import { describe, it, expect } from 'vitest';
import { resolveDataPedida } from './resumo-diario';

// feature-040 pedido 1 — a tela abre no último dia COM DADO.
//
// A regra literal do Fernando era "último dia útil". Ela foi trocada porque, depois das
// leituras de 11h e 14h do Snapshot Diário, o dia corrente passa a ter dado — e "último dia
// útil" esconderia justamente o dia que o telão precisa mostrar.

const DATAS = ['2026-08-26', '2026-08-27', '2026-08-28']; // qua, qui, sex

describe('resolveDataPedida', () => {
  it('"ultimo" numa segunda de manhã devolve a sexta, não o dia vazio', () => {
    expect(resolveDataPedida('ultimo', DATAS, '2026-08-31')).toBe('2026-08-28');
  });

  it('"ultimo" devolve HOJE assim que a leitura das 11h grava a linha do dia', () => {
    const comHoje = [...DATAS, '2026-08-31'];
    expect(resolveDataPedida('ultimo', comHoje, '2026-08-31')).toBe('2026-08-31');
  });

  it('data explícita vence — escolher no calendário continua funcionando', () => {
    expect(resolveDataPedida('2026-08-27', DATAS, '2026-08-31')).toBe('2026-08-27');
  });

  it('data explícita sem linha ainda é respeitada (a tela mostra o vazio de propósito)', () => {
    expect(resolveDataPedida('2026-08-30', DATAS, '2026-08-31')).toBe('2026-08-30');
  });

  it('sem nenhuma data disponível, "ultimo" cai para hoje em vez de quebrar', () => {
    expect(resolveDataPedida('ultimo', [], '2026-08-31')).toBe('2026-08-31');
  });

  it('lixo no parâmetro cai para hoje', () => {
    expect(resolveDataPedida('ontem', DATAS, '2026-08-31')).toBe('2026-08-31');
    expect(resolveDataPedida('', DATAS, '2026-08-31')).toBe('2026-08-31');
  });

  it('não depende da ordem em que as datas chegam', () => {
    const fora = ['2026-08-28', '2026-08-26', '2026-08-27'];
    expect(resolveDataPedida('ultimo', fora, '2026-08-31')).toBe('2026-08-28');
  });
});
