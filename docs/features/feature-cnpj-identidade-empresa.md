# Spec — CNPJ como identidade de empresa (e o `closing_date` que some)

> **v1 — 01/08/2026. Status: IMPLEMENTADA em 01/08 23:15.** Medição refeita sobre a base
> completa (231 deals) e os números confirmados — ver §Medição. Falta rodar a migração `0004`
> no Neon.
> Origem: achado #2 do portão de paridade (`empresa` vazia em 232/232 deals) —
> [`migracao-neon-fase1`](../../CLAUDE.md). Decisões do Marcos em 01/08 incorporadas:
> `CNPJ1` é resíduo · `closing_date` usa o mesmo fallback do resto · descrição fica fora.

## Problema

A base instalada agrupa clientes por **nome do negócio**, porque `empresa` está vazia. Medido
no CRM: `Account_Name` preenchido em **0 de 200** deals — não é falha de extração, os negócios
não têm Conta vinculada. Agrupar por nome é frágil: o nome muda no CRM e a identidade do
cliente muda junto.

O CNPJ resolve isso e **já existe no Zoho** — o nó `Zoho Deals` só não pedia o campo.

## O que foi medido (não suposto)

Puxada read-only do Zoho em 01/08 via `TMP Deals Pull`, **200 dos 232 deals** (o puxador não
pagina — ver Pendências):

| | |
|---|---|
| `CNPJ` preenchido | **179 / 200 (90%)** |
| com 14 dígitos | 178 |
| **dígito verificador válido** | **178 / 178 — zero erro de digitação** |
| malformado | 1 (`29.554.953/0001`, truncado) |
| `CNPJ1` preenchido | 7 |
| `Account_Name` preenchido | **0** |
| deals ganhos | 68 → **65 empresas distintas por CNPJ** |
| matriz/filial (mesma raiz de 8, CNPJ diferente) | **0** |

**O CNPJ não encontrou nenhuma duplicata que o nome já não encontrasse** — os 2 grupos são
Estaleiro (200+200 endpoints) e AMGS (105+10), os mesmos de antes. O ganho não é achar mais
duplicata; é chave estável, sem normalização heurística de razão social, e representação
correta do caso Estaleiro — **duas vendas reais para a mesma empresa**, confirmado pelo Marcos —
sem nenhuma regra de duplicata. Como não há caso de matriz/filial hoje, agrupar pelos 14
dígitos basta: não é preciso decidir nada sobre grupo econômico.

### O `CNPJ1` não é só resíduo

Dos 7 preenchidos, **6 são idênticos ao `CNPJ`** — resíduo, como o Marcos supôs. Mas o sétimo
inverte o caso:

```
Norteng Engenharia   CNPJ = "Localizando"   CNPJ1 = 01.200.622/0001-26
```

Duas consequências:

1. **`CNPJ` é texto livre e aceita palavra.** Qualquer leitura que assuma número quebra. A
   validação por dígito verificador rejeita `"Localizando"` sozinha — é o filtro certo.
2. **`CNPJ1` serve como fallback**, exatamente quando o campo principal tem lixo. Não como
   segunda identidade: **nunca** une duas empresas.

## Solução

### 1. Chave canônica

```
cnpj = primeiro valor entre [CNPJ, CNPJ1] que tenha 14 dígitos E dígito verificador válido
     = ""  se nenhum passar
```

Sem saneamento, sem heurística: ou passa na checagem, ou o campo fica vazio e o deal cai no
fallback de nome. Isso recupera o caso Norteng e descarta `"Localizando"` e o CNPJ truncado.

### 2. Identidade de empresa

```
identidade = cnpj           quando existe   (89% dos deals; 99% dos ganhos)
           = nome normalizado quando não     (minúsculas, sem acento, sem sufixo societário)
```

O nome continua sendo o **rótulo exibido** — o CNPJ é chave, não display. Nenhuma tela passa a
mostrar CNPJ por causa desta spec.

### 3. `closing_date` — decisão do Marcos: mesmo fallback

**13 dos 78 deals ganhos (17%) não têm `closing_date` — R$ 73.834 e 866 licenças.**

O resto do dashboard já resolve isso: [`metrics.ts`](../../src/lib/metrics.ts) usa
`closing_date || modified_time` em 14 pontos. O Farol **não**:

- [`farol.ts:84`](../../src/lib/farol.ts) — `dateInRange(d.closing_date, …)`, sem fallback
- [`farol.ts:126`](../../src/lib/farol.ts) — `DATE_RE.test(cd)` descarta o vazio explicitamente

Efeito hoje: essa receita não cai em **nenhuma** semana nem mês do Farol — não está adiada,
está fora. O SEICOM (ganho em 30/07, R$ 1.736) está fora do Farol da semana corrente enquanto
aparece nas outras telas.

**Correção:** adotar `closing_date || modified_time` nos dois pontos do `farol.ts`, alinhando
com `metrics.ts`. É a menor mudança que elimina a divergência entre telas.

Efeito colateral aceito e explícito: um ganho sem data de fechamento passa a ser atribuído à
semana da **última modificação**. Se o deal for editado depois, migra de semana. É o mesmo
comportamento que o resto do dashboard já tem — a spec não introduz a imprecisão, ela para de
tratá-la de dois jeitos diferentes.

## Mudanças

| Onde | O quê |
|---|---|
| n8n `Zoho Deals` | somar `CNPJ,CNPJ1` à lista de `fields` (nomes de API **verificados**) |
| n8n `Format Deals Raw` | derivar `cnpj` pela regra acima; `empresa` segue de `Account_Name` |
| Aba `deals` | nova coluna `cnpj` — **criar o cabeçalho à mão antes** de editar o nó |
| n8n `Sheets Deals` | mapear a coluna nova |
| `src/lib/types.ts` | `cnpj` em `RawDeal` |
| `src/lib/metrics.ts` | base instalada agrupa por identidade, não por nome |
| `src/lib/farol.ts` | fallback `|| modified_time` nos 2 pontos |
| `db/migrations/` | coluna `cnpj` em `deals` |
| `src/lib/ingest/` | `schema.ts`, `repo.ts` aceitam e gravam `cnpj` |

O projeto tem vitest (`npm test`). Cobrir: validação de dígito verificador (incluindo
`"Localizando"` e o truncado), fallback `CNPJ`→`CNPJ1`, agrupamento por identidade com o par
Estaleiro (deve dar **1 empresa, 400 licenças, R$ 22.040**), e o fallback do Farol com um ganho
sem `closing_date`.

## Cuidados

1. **`appendOrUpdate` não cria cabeçalho** e o nó tem `continueOnFail` — sem criar a coluna
   `cnpj` à mão primeiro, a escrita falha em silêncio com a execução verde. Mesma lição do
   [`feature-call-id-unico`](feature-call-id-unico.md).
2. **Coluna nova muda a forma da aba** — conferir a assinatura usada pela paridade de `deals`
   antes de publicar, senão o portão vira vermelho por desenho.
3. **A contagem de clientes vai cair** (68 ganhos → 65 empresas na amostra). É achado, não
   erro — mas revisar os pares unificados antes de aceitar a diferença, como já registrado no
   risco da Fase 1.
4. **`cnpj` é texto na planilha.** Com `USER_ENTERED`, `10843079000176` viraria número e
   perderia zeros à esquerda. Gravar **formatado** (`10.843.079/0001-76`) ou com prefixo, e
   conferir `cols[n].type === "string"` no gviz depois do primeiro run.

## Pendências antes de implementar

1. ~~**Medir sobre os 232 deals.**~~ **Feito** — o `TMP Deals Pull` ganhou paginação e a base
   completa foi medida: **231 deals** (a aba tem 232 linhas — sobra uma, ver abaixo),
   `CNPJ` canônico válido em **202 (87%)**, **1 salvo pelo `CNPJ1`**, 29 sem nenhum válido.
   Entre os **78 ganhos**: 77 com CNPJ → **76 empresas distintas**, 6.780 licenças, e
   **13 sem `closing_date` somando R$ 78.186,59**. A proporção da amostra se manteve.
   Sobra registrada: a aba `deals` tem **232 linhas para 231 deals no CRM** — uma linha a mais,
   mesma classe do duplicado de `leads` (`Wintress`). Não bloqueia; investigar à parte.
2. **1 CNPJ truncado** (Escritório de Advocacia Zveiter) e **1 com `"Localizando"`** (Norteng,
   resolvido pelo `CNPJ1`) — vale corrigir no CRM, mas não bloqueia: os dois caem no fallback
   de nome.

## Fora de escopo

**`Description`** — decisão do Marcos: não entra agora. A medição não sustentaria mesmo:
preenchida em 59/200 (30%), com `Produto:` em 28, `Boletos:` em 8 e `Valor/licença:` em **4**.
O formato estruturado do SEICOM (produto, preço unitário, calendário de boletos) é minoria; se
virar padrão de preenchimento, vira spec própria.

Também fora: vincular Conta nos deals do Zoho — o CNPJ torna isso desnecessário para esta
finalidade.
