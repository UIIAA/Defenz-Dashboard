# Spec — Indicador "clientes ganhos 100% taggeados" (setup concluído na console)

> **Spec 4 de 4** do lote "Dashboard – ajustes de julho" (brainstorm 2026-07-22 com o Marcos).
> **Integra à Spec 3** (drill-down da base instalada) — o indicador vive dentro do drawer.
> Herda a §Padrões visuais da Spec 1.

## Onde estamos

Os `deals` `Fechado Ganho` têm uma coluna **`tags`** (já exportada) com o **pipeline de setup** do
cliente na console Bitdefender. Tags reais observadas (65 ganhos, 2026-07-22):

| tag | deals | leitura |
|---|---|---|
| `cliente na console` | 26 | **setup concluído** (estado final) |
| `enviar health check` | 21 | em andamento |
| `hash e-mail enviado` / `reenviar e-mail hash` / `enviar e-mail hash` | 21 / 21 / 10 | em andamento |
| `sem e-mail` / `aguardando setup` / `aguardando hash` | 8 / 4 / 1 | pendente |
| `cliente recusou` / `cliente não está console` | 1 / 1 | **não concluído (problema)** |
| (sem tag) | 2 | não iniciado |

## Decisões travadas com o Marcos (2026-07-22)

1. **Métrica:** **% de clientes ganhos com setup concluído** = tem a tag **`cliente na console`**.
   Hoje ~**26/64 ≈ 40%**.
2. **Local:** **dentro do drawer da base instalada** (Spec 3) — % no topo + **badge de status por
   cliente** na lista.
3. **"Manter e atualizar":** lê ao vivo de `deals.tags` — atualiza sozinho a cada refresh. Sem
   mudança de dado/n8n.

## 1. Métrica (JS calcula)

Na agregação por empresa da Spec 3 (`src/lib/base-instalada.ts`), derivar o status de setup por
cliente a partir das tags dos negócios ganhos dele:

- Normalizar tags: `lowercase` + `trim` + colapsar espaços; split por `;`/`,`.
- **Cliente `concluído`** se **algum** negócio ganho dele tem a tag exata `cliente na console`.
  *(Agregação any-vs-all: proposto "any" — 1 console por cliente; confirmar no review.)*
- `setupConcluidoPct` = clientes concluídos ÷ total de clientes da base.

## 2. Status por cliente (badge) — regra de cor (§Padrões)

Quatro estados (herda a semântica: verde=ok, âmbar=atenção, vermelho=problema real, cinza=dado neutro):

| estado | condição | cor |
|---|---|---|
| ✓ **Na console** | tem `cliente na console` | verde |
| ⏳ **Em setup** | tem tag de pipeline, sem console | âmbar |
| ⚠ **Não está / recusou** | tem `cliente não está console` ou `cliente recusou` | **vermelho** (problema real legítimo) |
| **Não iniciado** | sem tag | cinza |

## 3. UI (no drawer da base instalada)

- **Headline** no topo do drawer: `Setup concluído: 40%` + `26 de 64 na console` (barra fina de
  progresso, cor de status).
- **Badge de status** por linha da lista (§2).
- **Filtro rápido** (opcional): "só pendentes" — vira lista de trabalho pra cobrar o setup. Útil pro
  operacional (não só pro pitch de venda).

## Arquivos afetados (mapa pro implementador)

| Arquivo | Mudança |
|---|---|
| `src/lib/base-instalada.ts` (da Spec 3) | + status de setup por cliente + `setupConcluidoPct` (a partir de `tags`) |
| `src/lib/types.ts` | `SetupStatus` no `BaseInstaladaCliente`; `setupConcluidoPct` em `BaseInstalada` |
| `src/components/diario/BaseInstaladaDrawer.tsx` (da Spec 3) | headline % + badge por linha + filtro "só pendentes" |
| testes | classificação de status (na console / em setup / recusou / sem tag), % agregado |

## Itens abertos (decidir na implementação/review)

- Agregação: cliente `concluído` se **algum** (proposto) ou **todos** os negócios ganhos dele estão
  na console? (renovação pode gerar 2º negócio.)
- `cliente recusou` / `não está console` conta como **vermelho** (proposto) ou só neutro?
- Matching exato `cliente na console` (proposto) vs `includes('console')` (mais tolerante a variação
  de digitação). Há 1 `cliente não está console` — cuidado pra o matching não confundir os dois.

## Relação com outras specs / notas

- **Depende da Spec 3** (drawer + agregação por empresa). Se a Spec 3 não for feita, este indicador
  precisa de um card próprio — mas a decisão do Marcos foi colocá-lo no drawer.
- Não confundir com o flag **gerenciado/não gerenciado** (fase 3 da Spec 3) nem com a tag **"Venda
  Defenz"** (fonte de receita, Spec 1) — são tags/campos diferentes.
- Reusa `deals.tags` — sem credencial/rota nova, sem mudança no n8n.

## Fora de escopo

- Automatizar/alterar as tags pelo dashboard (a verdade é o Zoho; aqui só lê).
- Detalhar cada etapa do pipeline de setup (health check, hash) — o indicador é binário concluído/não.
