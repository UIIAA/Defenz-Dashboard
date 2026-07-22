# Spec — Drill-down da base instalada (todas as ~64 por licença + segmento)

> **Spec 3 de 4** do lote "Dashboard – ajustes de julho" (brainstorm 2026-07-22 com o Marcos).
> Página `/diario`, card **"Base instalada"**. Herda a §Padrões visuais da Spec 1.

## Onde estamos

No `/diario` (`ResumoDiarioDashboard.tsx:361`) o card "Base instalada" mostra **top 8 contas**
(`baseShow.top_contas.slice(0,8)`, `{name, licencas}`) + "demais" como número. Fonte: snapshot
`resumo_diario` (colunas `base_top_contas` = **só top 7**, `base_demais_licencas`, `base_total_licencas
= 5968`, `base_clientes_ativos`). **A lista completa e o segmento NÃO existem no snapshot.**

**Correção do Marcos (2026-07-22):** a base instalada vem do **Zoho Negócios (Deals) `Fechado
Ganho`** — são os **64 `fechado ganho`** que já estão na aba `deals`. O que falta na exportação é o
campo **licenças** (existe no Zoho, o snapshot já o lê p/ o top-contas) e o **segmento** (campo novo).

## Decisões travadas com o Marcos (2026-07-22)

1. **Objetivo:** clicar no card e ver **todas as ~64** ordenadas por licença — pra usar no **discurso
   de venda** (mostrar a base pro prospect).
2. **Fonte:** Zoho Deals `Fechado Ganho`, **agregado por cliente (empresa)**, somando licenças.
3. **Segmento = setor/indústria**, mas é **campo novo/vazio** no Zoho → **fase 2** (submenu por
   segmento entra quando o Marcos preencher). Fase 1 = lista completa por licença.
4. **Futuro (fase 3):** flag **gerenciado / não gerenciado**.
5. **Dado:** adicionar `licencas` (e depois `segmento`) na exportação dos `deals` no n8n. Dashboard
   agrega e monta o drill-down (JS calcula).

## Faseamento

| Fase | Entrega | Dependência |
|---|---|---|
| **1 (esta spec)** | Drill-down: todas as ~64 empresas por licença, a partir dos `deals` fechado-ganho | n8n: `licencas` na exportação `deals` |
| **2** | Submenu / filtro por **segmento** | Marcos preenche "Setor" no Zoho + `segmento` na exportação |
| **3** | Flag **gerenciado / não gerenciado** | campo novo no Zoho + exportação |

## 1. Dado — exportação `deals` (n8n)

- Adicionar coluna **`licencas`** (número de licenças do negócio) à aba `deals` — nó `Format Deals
  Raw` / `Zoho Deals` do workflow `QjnzGicZHIPBNN1g` (o snapshot já lê esse campo do Zoho p/
  `base_top_contas`, então o field existe; é só incluir no export). `Number(...) || 0`.
- Fase 2: adicionar **`segmento`** (campo "Setor/Indústria" do negócio) — quando preenchido no Zoho.

## 2. Agregação (dashboard, JS calcula)

Nova função pura (ex.: `src/lib/base-instalada.ts`): a partir dos `deals` com `stage` = fechado ganho,
agrupar por **`empresa`** (fallback `nome` se empresa vazia), somando `licencas` e contando negócios.
Retorna a lista ordenada por licenças desc + totais (nº clientes, Σ licenças). Deve reproduzir os
números do snapshot (Σ licenças ≈ 5968, ~64 clientes) — **validar contra o snapshot** na implementação.

## 3. UI — drill-down (fase 1)

- **Gatilho:** no card "Base instalada" do `/diario`, um "ver todas as N" / clique no card abre o
  drill-down (modal/drawer — decidir; drawer lateral cabe melhor a uma lista longa).
- **Conteúdo:** headline (nº clientes · Σ licenças) + **lista completa das ~64 ordenada por licença
  desc**: `posição · empresa · licenças` (+ % da base, opcional). Busca por nome (input) ajuda no pitch.
- **Discurso de venda:** layout limpo/legível (é pra mostrar pro prospect) — herda §Padrões (cores
  neutras, tipografia AA). Sem vermelho de alarme.
- **Fase 2:** filtro/submenu por **segmento** (chips ou select) no topo do drill-down.
- **Fase 3:** badge **gerenciado / não gerenciado** por linha + filtro.

## Arquivos afetados (mapa pro implementador)

| Arquivo | Mudança |
|---|---|
| n8n `QjnzGicZHIPBNN1g` (`Format Deals Raw`) | + coluna `licencas` na exportação `deals` (fase 2: `segmento`) |
| `src/lib/base-instalada.ts` (novo) | agregação pura por empresa (Σ licenças, ordena, totais) |
| `src/lib/types.ts` | `RawDeal.licencas`; tipos `BaseInstaladaCliente`, `BaseInstalada` |
| `src/components/diario/ResumoDiarioDashboard.tsx` | card "Base instalada" clicável → drill-down |
| `src/components/diario/BaseInstaladaDrawer.tsx` (novo) | drawer/modal com lista + busca (fase 2: filtro segmento) |
| testes | agregação por empresa, ordenação, totais vs snapshot |

## Itens abertos (decidir na implementação/review)

- Drill-down = **drawer lateral** (recomendado p/ lista longa) vs modal central.
- Ler a base do dashboard a partir de `deals` (recomendado, live, full list) **ou** estender o
  snapshot p/ emitir a lista completa. Proposta: **`deals`** (dashboard agrega).
- Mostrar % da base por cliente? Ticket/valor por cliente junto?
- Um cliente com múltiplos negócios ganhos: somar licenças (proposto) — confirmar se não há
  contagem dupla de renovação (renovação re-registra licenças?). **Validar contra o total 5968.**

## Relação com outras specs / notas

- Reusa o `deals` (mesma fonte da Spec 1). Nenhuma nova credencial/rota sensível na fase 1.
- "gerenciado/não gerenciado" e "clientes 100% taggeados" (Spec 4) são flags diferentes — não
  confundir: Spec 4 é sobre a tag de setup; aqui é sobre gestão do cliente.

## Fora de escopo

- Fase 2 (segmento) e fase 3 (gerenciado) — dependem de campos novos no Zoho; entram depois.
- Edição de licenças/segmento pelo dashboard (a verdade é o Zoho).
