import { describe, it, expect } from 'vitest';
import { nomeNorm, splitTags, coletarDimensao } from './normalize';

describe('nomeNorm', () => {
  it('sobe pra maiúscula, corta as pontas e colapsa espaço interno', () => {
    expect(nomeNorm('  Infracommerce   Ltda ')).toBe('INFRACOMMERCE LTDA');
  });

  it('unifica variações de caixa do mesmo nome', () => {
    expect(nomeNorm('infracommerce')).toBe(nomeNorm('INFRACOMMERCE'));
  });

  it('trata quebra de linha e tab como espaço', () => {
    expect(nomeNorm('Grupo\tSaint\nGobain')).toBe('GRUPO SAINT GOBAIN');
  });

  it('vazio, só espaço, null e undefined viram null', () => {
    expect(nomeNorm('')).toBeNull();
    expect(nomeNorm('   ')).toBeNull();
    expect(nomeNorm(null)).toBeNull();
    expect(nomeNorm(undefined)).toBeNull();
  });
});

describe('splitTags', () => {
  it('quebra por vírgula e tira espaço das pontas', () => {
    expect(splitTags('Setup Concluido, Na Console ,Renovacao')).toEqual([
      'Setup Concluido',
      'Na Console',
      'Renovacao',
    ]);
  });

  it('descarta itens vazios', () => {
    expect(splitTags('a,,  ,b')).toEqual(['a', 'b']);
  });

  it('deduplica (a PK é (deal_id, tag) — repetida quebraria o upsert)', () => {
    expect(splitTags('a, a, A')).toEqual(['a', 'A']);
  });

  it('vazio/null vira lista vazia', () => {
    expect(splitTags('')).toEqual([]);
    expect(splitTags(null)).toEqual([]);
    expect(splitTags(undefined)).toEqual([]);
  });
});

describe('coletarDimensao', () => {
  it('devolve pares únicos nome_norm/nome_exibicao', () => {
    const rows = [{ empresa: 'Infracommerce' }, { empresa: 'Vivo' }];
    expect(coletarDimensao(rows, 'empresa')).toEqual([
      { nome_norm: 'INFRACOMMERCE', nome_exibicao: 'Infracommerce' },
      { nome_norm: 'VIVO', nome_exibicao: 'Vivo' },
    ]);
  });

  it('deduplica por nome_norm mantendo a primeira exibição vista', () => {
    const rows = [{ empresa: 'Infracommerce' }, { empresa: '  INFRACOMMERCE ' }];
    expect(coletarDimensao(rows, 'empresa')).toEqual([
      { nome_norm: 'INFRACOMMERCE', nome_exibicao: 'Infracommerce' },
    ]);
  });

  it('ignora linhas sem o campo', () => {
    const rows = [{ empresa: '' }, { empresa: null }, {}, { empresa: 'Vivo' }];
    expect(coletarDimensao(rows, 'empresa')).toEqual([
      { nome_norm: 'VIVO', nome_exibicao: 'Vivo' },
    ]);
  });
});
