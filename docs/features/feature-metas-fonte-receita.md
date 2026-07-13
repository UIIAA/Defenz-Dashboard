# Spec (aterrissada) — /metas: separar fonte da receita (Repasse SS × Venda Defenz)

> **Origem:** Marcos — "no /metas a receita tem que separar quem trabalhou a venda; senão o esforço não encontra respaldo no financeiro". Aterrissada contra o dado real (13/07/2026).
> **Status:** Draft — para aprovação. Depende de uma ação sua no Zoho (taggar deals).

## 1. Problema (com evidência)
Há **dois formatos de venda**: (1) **Repasse SS** — a SecuriSoft vende e repassa (nosso esforço não gerou o resultado); (2) **Venda Defenz** — nós trabalhamos a venda (mesmo vindo de lista SS). Hoje o /metas soma tudo → "por que bati/não bati" mente (dá pra "bater" só com repasse, zero esforço).

**Por que a origem não resolve (medido):** dos ganhos, `securisoft` = **50 deals / R$ 532k (91%)**, `direto` = 8 / R$ 49k, `parceiro` = 2 / R$ 0,7k. Todos os 50 SS têm Lead_Source "Parceiro SS" → a origem junta repasse e venda-trabalhada num balde.

**Por que a inferência não resolve (medido):** usando `Resultados` como sinal de esforço nos 50 SS — "não-vazio" = 41/50 (R$ 525k, quase tudo), "tem data DD/MM" = 12/50 (R$ 37k), "tem tag [APRES]" = 1/50. O split pula de R$525k→R$37k conforme o threshold → **não é confiável**. O `owner` também não separa (quase todo SS tem dono Defenz; ex.: Amapá tem dono Gustavo e `Resultados` vazio).

## 2. Decisões (do Marcos, 13/07/2026)
| # | Decisão |
|---|---|
| Sinal | **Marcador por deal no Zoho** (não inferência) — único jeito confiável |
| Formato | **Etiqueta/Tag** no deal (não campo custom) |
| Meta R$6k | Conta **só a receita Venda Defenz**; Repasse SS fica FORA da meta (informativo) |
| Escopo | **Só o /metas** (Farol Fase 1 no /diario segue no total — ver §6) |
| Visual | **Barra empilhada / 2 cores**, total visível |

## 3. Regra de fonte da receita (por deal)
```
fonteVenda(deal):
  categoria ∈ {direto, parceiro}      → 'defenz'    // claramente nossa pela origem
  tem tag "Venda Defenz"              → 'defenz'    // lead SS que nós trabalhamos (marcado)
  senão (securisoft sem tag)          → 'repasse'   // repasse SS (default)
```
> Você só precisa taggar os **deals SS que vocês trabalharam** — os ~50 SS de hoje (uma vez) + os novos daqui pra frente. `direto`/`parceiro` não precisam de tag.
> Nome da tag proposto: **`Venda Defenz`** (asserção positiva). Ajustável.

## 4. Mudança nos dados (n8n + Sheets)
1. **Zoho Deals (node do `QjnzGicZHIPBNN1g`)**: garantir que as **tags** do deal venham na resposta (Zoho v2 devolve `Tag: [{name}]`; confirmar/incluir no fetch).
2. **Format Deals Raw**: extrair os nomes das tags (`d.Tag[].name` → string juntada por `, `) e **adicionar `tags` ao output**. A lógica de fonte fica na **Vercel** (princípio "JS calcula na Vercel"), não no n8n.
3. **Aba `deals`**: nova coluna `tags`. Cabeçalho antes do node.
4. **Re-run** do export (reflete os deals já tagueados).
> Obs.: fica isolado no export de deals; nenhum outro fluxo muda.

## 5. Vercel — `/metas`
- `RawDeal` ganha `tags?: string`.
- `src/lib/metas.ts`: `fonteVenda(deal)` (§3: `categoria` ∈ {direto,parceiro} → defenz; senão tags contém `Venda Defenz` → defenz; senão repasse). `weekRevenue` devolve `{ defenz, repasse }` (soma `valor` dos ganhos por fonte na janela). **Meta / pctAbs / cor / label / diagnóstico usam só `defenz`.** `repasse` é informativo.
- `WeekMetric`: `revenue` vira `{ defenz, repasse, total }` (ou campos separados) — **TDD** cobrindo o split.
- **UI (barra empilhada):** comparativo com 2 séries — `Venda Defenz` (vermelho Defenz `#dc2626`) + `Repasse SS` (cinza/azul), total no topo. Header da semana: "R$ X trabalhada / R$ 6.000 meta" + linha "+ R$ Y repasse SS". O bloco "por que bati/não bati" continua só sobre a Venda Defenz.

## 6. Reconciliação / divergência conhecida
Como o escopo é **só /metas**, o **Farol Fase 1 (/diario) segue somando o total** (Venda + Repasse). Então /diario e /metas podem mostrar receitas diferentes (ex.: Amapá repasse → conta no Farol, não na meta trabalhada). **Isso é esperado** e deve ter uma nota na UI. Estender a distinção ao Farol/executivo é decisão futura (fora desta spec).

## 7. Faseamento
1. **Você:** criar/aplicar a tag `Venda Defenz` nos deals SS trabalhados (Zoho). *(bloqueia o dado, não o código)*
2. **n8n:** exportar `fonte_venda` (§4). 
3. **Vercel:** split no `metas.ts` + UI empilhada + meta só-defenz (§5), TDD. *(pode ser feito em paralelo com o passo 1, com dado de teste)*

## 8. Itens abertos
- [ ] Confirmar que a API do Zoho devolve as tags do deal no fetch atual (senão ajustar o node).
- [ ] `parceiro` (43%) conta como `defenz` sempre? (assumido sim — refinar se houver repasse de parceiro).
- [ ] Nome final da tag (`Venda Defenz`?) e se marca a venda-nossa ou o repasse (proposto: marca a nossa).
- [ ] Nota de UI explicando a divergência /diario × /metas (§6).
- [ ] Comissão: a taxa (5% SS) é assunto financeiro separado — não afeta `fonte_venda` (que é sobre esforço). Fora de escopo.
