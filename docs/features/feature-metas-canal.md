# Spec — Meta em "Receita por Canal" (onde nascem as vendas) + edição inline

> **Spec 2 de 4** do lote "Dashboard – ajustes de julho" (brainstorm 2026-07-21/22 com o Marcos).
> Página `/` (executiva), seção **"Financeiro — Receita por Canal"**. Herda a §Padrões visuais da
> [`feature-metas-v2-faturamento-esforco.md`] (Spec 1). Mockup: `.superpowers/brainstorm/*/content/canal-meta.html`.

## Onde estamos

Na página `/` (`ExecutiveDashboard.tsx`, componente `ReceitaPorCanalSection`) já existe a seção
**"Financeiro — Receita por Canal"**: barra de proporção horizontal + 3 cards por canal
(`direto` / `parceiro` / `securisoft`) com `valor_fechado`, `comissao_fechado`, `deals`, `percentual`,
e uma linha de totais (`total_valor`, `total_comissao`, `total_deals`). Dados via
`ReceitaPorCanalMetrics` (`src/lib/types.ts`), computados por `computeReceitaPorCanal()`
(`src/lib/metrics.ts:913`) e servidos em `sheetsData._receita_por_canal`
(`useDashboardData.ts`). Período vem do `DateRangeProvider` global.

**Problema (Marcos):** "número sozinho ninguém olha" — falta **referência (meta)**. E as cores dos
canais hoje são `direto=azul`, `parceiro=violeta`, `securisoft=vermelho` — vermelho lê como alarme
(viola a regra de cor da Spec 1).

## Decisões travadas com o Marcos (2026-07-22)

1. **Formato:** opção **A** do mockup — **meta de receita por canal** (cada canal com R$ alvo + barra
   de atingimento) **+ consolidado** (Σ receita vs Σ metas, com farol próprio).
2. **Origem da meta:** **fixa mensal por canal** (Marcos define o R$/mês), que **escala
   proporcional ao período** filtrado.
3. **Edição:** **inline** — ícone de lápis na própria seção → edita os 3 valores ali; **só admin** vê/edita.
4. **Persistência:** **Neon** (já no projeto nesta branch, com a auth) — reusa `src/lib/db.ts` e o
   papel `admin` do `verifySession`.
5. **Cor:** herda a §Padrões (Spec 1) — canais em grafite/cinza (dado), status verde/âmbar/vermelho
   (reservado). **SecuriSoft nunca em vermelho de alarme.**

## 1. Meta por canal + atingimento

Cada card de canal ganha:
- **Meta do período** (R$) = `meta_mensal[canal] × (dias no período ÷ 30)` — arredondada.
- **Barra de atingimento** `valor_fechado / meta_periodo`, cor de status pela §Padrões
  (`NO RITMO`/`META BATIDA` verde · `ATENÇÃO` âmbar · `CRÍTICO` vermelho reservado).
- `% da meta` no lugar (ou ao lado) do `% do total` atual — decidir na implementação se mostra os dois.

**Escala (dias/30):** o período da `/` é arbitrário (DateRangeProvider). `dias no período` =
`diffDays(to, from) + 1`. Fator `/30` é aproximação simples e tunável (alternativa: dias reais dos
meses cobertos). Meta mensal 0 (não definida) → esconder barra/status daquele canal e mostrar só o valor.

## 2. Consolidado (Total)

Linha/card **Total** abaixo dos 3 canais:
- **Receita total** (`total_valor`, já existe) **vs Σ metas escaladas** dos 3 canais.
- Barra de atingimento + status próprio (mesma regra de cor).
- Rótulo: "Total · X% da meta do período".

## 3. Cor — aplicar a §Padrões (corrige o vermelho da SecuriSoft)

Substituir `CANAL_COLORS` (azul/violeta/**vermelho**) por identidade neutra de **dado**:
- `direto` → grafite `#334155` (a venda nossa, mais "forte").
- `parceiro` → cinza médio `#64748b`.
- `securisoft` → cinza claro `#cbd5e1`.
Barras de **atingimento** usam **cor de status** (âmbar/verde/vermelho-reservado), não a cor do canal.
Assim o canal (dado) e o desempenho (status) ficam visualmente separados.

## 4. Edição inline (lápis, só admin)

- **Gatilho:** ícone de lápis no canto da seção, **renderizado só se `session.role === 'admin'`**
  (a sessão já carrega `role`). Membro comum não vê o lápis.
- **Modo edição:** troca os 3 cards por 3 inputs (`meta mensal` por canal, BRL) + botões
  **Salvar / Cancelar**. Validação: número ≥ 0.
- **Salvar:** `PUT /api/metas-canal` → grava no Neon → refetch dos targets → sai do modo edição.
- Sem otimismo complexo: salvar → recarrega os valores do servidor.

## 5. Backend (Neon + API)

**Tabela Neon `channel_targets`:**

| coluna | tipo | nota |
|---|---|---|
| `categoria` | text PK | `'direto' \| 'parceiro' \| 'securisoft'` |
| `valor_mensal` | numeric | meta R$/mês (default 0) |
| `updated_at` | timestamptz | |
| `updated_by` | text | e-mail do admin |

Seed: 3 linhas (uma por categoria), `valor_mensal = 0`. Migration junto do `scripts/users.mjs`
(mesmo padrão `process.loadEnvFile` + `DATABASE_URL_UNPOOLED`).

**Rota `src/app/api/metas-canal/route.ts`:**
- `GET` — retorna os 3 targets. Protegida por `verifySession` (qualquer usuário logado).
- `PUT` — atualiza os targets. `verifySession` **+ checagem `role === 'admin'`** (401/403 senão).
  Body: `{ direto: number, parceiro: number, securisoft: number }`. Grava `updated_by = session.email`.

**Leitura no front:** `ExecutiveDashboard` busca os targets (novo hook/`fetch` a `/api/metas-canal`),
computa a meta escalada com o `dateRange` atual, e passa pra `ReceitaPorCanalSection`.

## Arquivos afetados (mapa pro implementador)

| Arquivo | Mudança |
|---|---|
| `scripts/users.mjs` (ou novo `scripts/metas-canal.mjs`) | migration + seed da tabela `channel_targets` |
| `src/lib/db.ts` | reuso (Neon lazy) — sem mudança estrutural |
| `src/lib/metas-canal.ts` (novo) | tipos + escala pura (`metaPeriodo(mensal, dias)`) + leitura/escrita Neon |
| `src/lib/types.ts` | `ChannelTarget`, `ChannelTargets`, meta/atingimento no item de canal |
| `src/app/api/metas-canal/route.ts` (novo) | `GET` (logado) + `PUT` (admin) |
| `src/components/dashboard/ExecutiveDashboard.tsx` | `ReceitaPorCanalSection`: meta + barra + consolidado + edição inline; trocar `CANAL_COLORS` (§3) |
| `src/components/dashboard/ChannelTargetsEditor.tsx` (novo, opcional) | form inline de edição |
| `src/hooks/useDashboardData.ts` (ou hook novo) | fetch dos targets |
| testes | escala, gate admin do PUT, cor de status |

## Itens abertos (decidir na implementação/review)

- Escala: `/30` (simples) vs dias reais dos meses do período. Proposta: `/30`.
- Mostrar `% da meta` **e** `% do total`, ou só `% da meta`?
- Valores iniciais das metas (seed 0 → Marcos preenche na 1ª vez via lápis; ou já semear com números
  que ele passar).
- **Resolvido (2026-07-22):** os **3 canais têm meta** (incl. SecuriSoft). Consolidado = Σ dos 3
  canais vs Σ das 3 metas.

## Relação com a Spec 1 (não confundir as metas)

- `/metas` → meta **semanal R$6.000 de Venda Defenz** (defenz-only, `fonteVenda`).
- `/` Receita por Canal → meta **mensal por canal** (inclui SecuriSoft), classificação por `categoria`
  (lead_source). São métricas **independentes** e de propósito diferente — não precisam bater. O
  "Direto" aqui ≈ "venda nossa", mas a definição não é idêntica à de `fonteVenda`. Documentar pra não
  gerar expectativa de reconciliação.

## Notas de segurança

- `PUT /api/metas-canal` é a **primeira rota de escrita gated por papel** do dashboard — reusa o
  `role` do `verifySession` (auth feature). Testar: membro comum recebe 403; cookie sem `sub`/`role`
  recusado. `GET` não expõe nada sensível (são metas de gestão).
- Neon: usar a conexão pooled (`DATABASE_URL`) na rota; migration com unpooled.

## Fora de escopo

- Metas por vendedor/pessoa (só por canal aqui).
- Página `/config` genérica (a edição é inline; `/config` fica pra Spec futura se surgir mais config).
- Histórico de alterações de meta (só `updated_at`/`updated_by` do último).
