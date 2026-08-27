import { describe, it, expect } from "vitest";
import { isAberto, computeOportunidades } from "./oportunidades";
import type { RawDeal } from "./types";

const HOJE = "2026-08-26";

describe("isAberto — denylist, não allowlist", () => {
  it("os 6 estágios reais do pipe são abertos", () => {
    for (const s of [
      "Proposta Enviada", "Reunião Técnica", "Proposta / Governo",
      "Em Trial / POC", "Em negociação", "E-Mail de Aceite Enviado",
    ]) expect(isAberto(s)).toBe(true);
  });

  it("fechados e geladeira ficam de fora", () => {
    for (const s of [
      "Fechado Ganho", "Fechado perdido",
      "Fechado perdido para a concorrência", "Fechado perdido para a concorrencia",
      "Contato Futuro",
    ]) expect(isAberto(s)).toBe(false);
  });

  it("estágio DESCONHECIDO aparece — é o ponto da denylist", () => {
    // `Grandes Contas` existe no picklist do Zoho e sumiu da v1 da spec por causa de uma
    // allowlist. Com denylist, estágio novo entra na tela em vez de sumir calado.
    expect(isAberto("Grandes Contas")).toBe(true);
    expect(isAberto("Estágio Que Ainda Não Existe")).toBe(true);
  });

  it("estágio vazio não é aberto", () => {
    expect(isAberto("")).toBe(false);
  });
});

describe("computeOportunidades", () => {
  const deals: RawDeal[] = [
    { id: "1", nome: "Grande sem cor", stage: "Proposta Enviada", valor: 30000, resultados: "20/08 - proposta" },
    { id: "2", nome: "Pequeno sem cor", stage: "Reunião Técnica", valor: 500, resultados: "" },
    { id: "3", nome: "Quente", stage: "Em negociação", valor: 9000, temperatura: "quente", resultados: "01/08 - call" },
    { id: "4", nome: "Ganho", stage: "Fechado Ganho", valor: 99999 },
    { id: "5", nome: "Geladeira", stage: "Contato Futuro", valor: 45000 },
  ];

  it("filtra para os abertos e soma só eles", () => {
    const r = computeOportunidades(deals, HOJE);
    expect(r.total).toBe(3);
    expect(r.valor_total).toBe(39500);
    expect(r.itens.map((x) => x.id)).not.toContain("4");
    expect(r.itens.map((x) => x.id)).not.toContain("5");
  });

  // MUDOU na feature-038. Antes o card sem TEMPERATURA vinha no topo, para a tela cobrar.
  // Agora a ordem é por POSSE (parado, nossa, cliente, e sem estado por último), e a cobrança
  // vive nos contadores do cabeçalho. Motivo em computeOportunidades: o bucket "sem estado"
  // nasce com os 68 cards e enterraria os R$ 93 mil de "parado".
  it("ordena por posse e, dentro do grupo, por valor decrescente", () => {
    const r = computeOportunidades(
      [
        { id: "cli", nome: "Cliente pequeno", stage: "Em negociação", valor: 100, estado_negocio: "Proposta em análise" },
        { id: "sem", nome: "Sem estado, o maior de todos", stage: "Em negociação", valor: 99000 },
        { id: "par1", nome: "Parado grande", stage: "Em negociação", valor: 5000, estado_negocio: "Bloqueio declarado" },
        { id: "nos", nome: "Nossa", stage: "Em negociação", valor: 8000, estado_negocio: "Reunião a agendar" },
        { id: "par2", nome: "Parado pequeno", stage: "Em negociação", valor: 900, estado_negocio: "Contato sem retorno" },
      ],
      HOJE
    );
    expect(r.itens.map((x) => x.id)).toEqual(["par1", "par2", "nos", "cli", "sem"]);
    expect(r.grupos).toEqual([
      { posse: "parado", n: 2, valor: 5900 },
      { posse: "nossa", n: 1, valor: 8000 },
      { posse: "cliente", n: 1, valor: 100 },
      { posse: "", n: 1, valor: 99000 },
    ]);
    expect(r.sem_estado).toBe(1);
  });

  it("conta quem está sem temperatura, mesmo sem usar isso para ordenar", () => {
    const r = computeOportunidades(deals, HOJE);
    expect(r.total).toBe(3);
    expect(r.sem_classificacao).toBe(2);
    // Nenhum deles tem estado ainda: é o retrato de antes de a rotina do Chief rodar.
    expect(r.sem_estado).toBe(3);
    expect(r.grupos).toEqual([{ posse: "", n: 3, valor: 39500 }]);
    // Sem estado, o desempate é o valor.
    expect(r.itens.map((x) => x.id)).toEqual(["1", "3", "2"]);
  });

  it("a ficha do ambiente e a janela dos 90 dias saem do campo do Zoho", () => {
    const r = computeOportunidades(
      [
        { id: "a", nome: "Vence dentro da janela", stage: "Proposta Enviada", valor: 700,
          estado_negocio: "Proposta em análise", antivirus_atual: "Acronis",
          vencimento_licenca: "2026-10-01", licencas: 8 },
        { id: "b", nome: "Vence longe", stage: "Proposta Enviada", valor: 7000,
          estado_negocio: "Proposta em análise", vencimento_licenca: "2027-02-01" },
        { id: "c", nome: "Sem vencimento", stage: "Proposta Enviada", valor: 70,
          estado_negocio: "Proposta em análise" },
      ],
      "2026-08-27"
    );
    const [b, a, c] = r.itens; // ordenados por valor dentro do grupo 'cliente'
    expect(a.janela).toBe(true);
    expect(a.dias_para_vencer).toBe(35);
    expect(a.antivirus_atual).toBe("Acronis");
    expect(b.janela).toBe(false);
    expect(c.janela).toBe(false);
    expect(c.dias_para_vencer).toBeNull();
    expect(c.antivirus_atual).toBeNull();
    expect(r.janela).toEqual([
      { id: "a", nome: "Vence dentro da janela", valor: 700, vencimento: "2026-10-01" },
    ]);
  });

  it("traduz o dono do negócio e não deixa a linha sem ninguém", () => {
    const r = computeOportunidades(
      [
        { id: "a", nome: "Do Leonardo", stage: "Em negociação", valor: 3,
          owner_id: "7067822000000576001", owner_nome: "vendor 2" },
        { id: "b", nome: "Do Gustavo", stage: "Em negociação", valor: 2,
          owner_id: "7067822000000743027", owner_nome: "Gustavo Figueira" },
        { id: "c", nome: "Órfão", stage: "Em negociação", valor: 1 },
      ],
      HOJE
    );
    expect(r.itens.map((x) => x.dono)).toEqual(["Leonardo", "Gustavo F", "sem dono"]);
  });

  it("estado fora da lista dos 11 vira vazio e o card não some da tela", () => {
    const r = computeOportunidades(
      [{ id: "x", nome: "n", stage: "Em negociação", estado_negocio: "Estado inventado" }],
      HOJE
    );
    expect(r.total).toBe(1);
    expect(r.itens[0].estado).toBe("");
    expect(r.itens[0].posse).toBe("");
  });

  it("valor fora do picklist vira vazio, não quebra", () => {
    const r = computeOportunidades(
      [{ id: "x", nome: "n", stage: "Em negociação", temperatura: "TÉPIDO" }],
      HOJE
    );
    expect(r.itens[0].temperatura).toBe("");
  });

  it("aceita o valor do Zoho com maiúscula e acento", () => {
    const r = computeOportunidades(
      [{ id: "x", nome: "n", stage: "Em negociação", temperatura: " Quente " }],
      HOJE
    );
    expect(r.itens[0].temperatura).toBe("quente");
  });

  it("sem data no resultados: null, não zero", () => {
    const r = computeOportunidades(deals, HOJE);
    const pequeno = r.itens.find((x) => x.id === "2")!;
    expect(pequeno.ultimo_toque).toBeNull();
    expect(pequeno.dias_sem_toque).toBeNull();
  });

  it("NUNCA devolve comissao_valor — a tela é aberta ao time", () => {
    const r = computeOportunidades(
      [{ id: "x", nome: "n", stage: "Em negociação", valor: 1000, comissao_valor: 580 }],
      HOJE
    );
    expect(JSON.stringify(r)).not.toContain("comissao");
    expect(JSON.stringify(r)).not.toContain("580");
  });
});
