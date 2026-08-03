import { describe, it, expect } from 'vitest';
import {
  cnpjValido,
  cnpjCanonico,
  formatarCnpj,
  normalizarNomeEmpresa,
  identidadeEmpresa,
} from './cnpj';

// Todos os CNPJs abaixo saíram da puxada real do Zoho em 01/08/2026.
const SEICOM = '10.843.079/0001-76';
const NORTENG = '01.200.622/0001-26';
const ESTALEIRO = '07699082000153';

describe('cnpjValido', () => {
  it('aceita CNPJ real, com ou sem máscara', () => {
    expect(cnpjValido(SEICOM)).toBe(true);
    expect(cnpjValido('10843079000176')).toBe(true);
    expect(cnpjValido(ESTALEIRO)).toBe(true);
  });

  it('rejeita o texto livre que o campo do Zoho aceita', () => {
    // caso real: deal Norteng Engenharia tinha CNPJ = "Localizando"
    expect(cnpjValido('Localizando')).toBe(false);
    expect(cnpjValido('')).toBe(false);
    expect(cnpjValido(null)).toBe(false);
    expect(cnpjValido(undefined)).toBe(false);
  });

  it('rejeita CNPJ truncado', () => {
    // caso real: Escritório de Advocacia Zveiter, "29.554.953/0001" (faltam os 2 dígitos)
    expect(cnpjValido('29.554.953/0001')).toBe(false);
  });

  it('rejeita dígito verificador errado', () => {
    expect(cnpjValido('10843079000177')).toBe(false);
    expect(cnpjValido('11111111111111')).toBe(false);
  });
});

describe('cnpjCanonico', () => {
  it('usa o primeiro campo quando ele é válido', () => {
    expect(cnpjCanonico(SEICOM, '')).toBe('10843079000176');
  });

  it('cai para CNPJ1 quando o principal tem lixo (caso Norteng)', () => {
    expect(cnpjCanonico('Localizando', NORTENG)).toBe('01200622000126');
  });

  it('devolve vazio quando nenhum campo passa', () => {
    expect(cnpjCanonico('Localizando', '')).toBe('');
    expect(cnpjCanonico('29.554.953/0001', null)).toBe('');
  });
});

describe('formatarCnpj', () => {
  it('formata para gravar no Sheets como texto', () => {
    expect(formatarCnpj('10843079000176')).toBe('10.843.079/0001-76');
  });

  it('não formata o que não é válido', () => {
    expect(formatarCnpj('Localizando')).toBe('');
  });
});

describe('normalizarNomeEmpresa', () => {
  it('remove acento, sufixo societário e pontuação', () => {
    // "em recuperação judicial" é status jurídico, não identidade — sai inteiro
    expect(normalizarNomeEmpresa('ESTALEIRO ATLANTICO SUL S/A EM RECUPERACAO JUDICIAL'))
      .toBe('estaleiro atlantico sul');
    expect(normalizarNomeEmpresa('AMGS Comércio e Representações LTDA'))
      .toBe('amgs comercio e representacoes');
  });
});

describe('identidadeEmpresa', () => {
  it('agrupa pelo CNPJ quando existe', () => {
    const a = identidadeEmpresa({ cnpj: SEICOM, nome: 'SEICOM LTDA' });
    const b = identidadeEmpresa({ cnpj: '10843079000176', nome: 'seicom (renovação)' });
    expect(a).toBe(b);
  });

  it('cai para o nome normalizado quando não há CNPJ', () => {
    expect(identidadeEmpresa({ nome: 'Consórcio Triângulo' })).toBe('nome:consorcio triangulo');
  });

  it('não deixa nome numérico colidir com CNPJ', () => {
    expect(identidadeEmpresa({ nome: '10843079000176' }))
      .not.toBe(identidadeEmpresa({ cnpj: SEICOM }));
  });
});
