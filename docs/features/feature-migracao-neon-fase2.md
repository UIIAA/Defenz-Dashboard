# Spec — Fase 2: virar a leitura para o Neon sem ninguém sentir

> Continuação de [`feature-migracao-neon.md`](feature-migracao-neon.md) (Fase 1: escrita dupla,
> **concluída na implementação, portão ainda vermelho** — ver
> [`ATESTADO_PARIDADE_NEON_2026-07-28.md`](../ATESTADO_PARIDADE_NEON_2026-07-28.md)).
>
> **Status: proposta. Não implementar sem aprovação.**

## Objetivo

Passar a **ler** do Neon sem que o time perceba. Sucesso não é "migrou": é **ninguém abrir o
dashboard e notar diferença** — nem número, nem lentidão, nem tela quebrada.

O Sheets **continua sendo escrito** durante toda a Fase 2. Desligar a escrita é Fase 3, spec
própria. Enquanto o Sheets estiver vivo, voltar atrás custa segundos.

## O que torna a virada imperceptível

O contrato de dados **não muda**. As rotas hoje leem `RawDeal[]`, `RawCall[]`, `RawEmail[]`… e
entregam para `computeMetrics`, `computeFarol`, `aggregateBaseInstalada`. Se o Neon devolver
exatamente esses mesmos tipos, **nada acima da leitura precisa saber de onde veio**.

```
hoje:      route → fetchFromSheets('deals') → RawDeal[] → computeMetrics
fase 2:    route → lerDeals()               → RawDeal[] → computeMetrics
                     ├─ sheets  (padrão)
                     └─ neon    (quando a flag ligar)
```

Nenhum componente, nenhum hook, nenhum cálculo é tocado. É por isso que a virada não é sentida:
não existe "versão Neon" da tela.

## Decisões propostas

### 1. Flag **por tabela**, não global

`NEON_READ=deals,emails` — vira uma tabela de cada vez. Uma tabela ruim não derruba a página
inteira, e o rollback é remover um nome da lista.

**A flag mora no banco** (tabela `config`, igual `channel_targets`), não em env var. Motivo: env
var na Vercel exige redeploy pra voltar atrás; um `update` no banco volta em segundos, e quem
precisa reverter às 19h de uma sexta não deveria depender de build.

### 2. Shadow read antes de virar

Antes de a flag ligar de verdade, a rota lê **dos dois** e compara — usando **sempre o resultado
do Sheets**. A divergência vai pro log, não pra tela. É o portão de paridade, mas no caminho real
de leitura, com os filtros reais de período, e não em agregado.

Isso pega o que a paridade de contagem não pega: um `closing_date` que virou `null`, um `valor`
que perdeu centavo, um deal que sumiu do filtro por causa de fuso.

Custo: dobra a leitura durante a janela de shadow. Aceitável por ser temporário e por já haver
cache de 30 min.

### 3. Critério de virada, por tabela

Uma tabela só vira quando, **ao mesmo tempo**:

- `GET /api/ingest/paridade?tabela=X` verde por **7 dias corridos**;
- shadow read sem divergência por **3 dias corridos** no caminho real;
- a query do Neon responde mais rápido que o gviz equivalente (se for mais lenta, o time sente —
  e isso é motivo de não virar).

### 4. Ordem de virada — da mais barata pra mais cara

1. `emails` — tabela mais simples, sem FK, já verde na paridade.
2. `leads` — verde, alimenta correlação.
3. `deals` — o coração (receita, farol, base instalada). Vira sozinha, num dia útil de manhã.
4. `ligacoes` — maior volume; é aqui que o Neon ganha do gviz de verdade.
5. `agenda`, `classificacao_ia`, `resumo_diario` — o resto.

### 5. O que NÃO entra nesta fase

- Desligar ou reduzir a escrita no Sheets (Fase 3).
- Reescrever cálculo em SQL. `computeMetrics` continua em TypeScript; o Neon só substitui a
  **origem das linhas**. Mover conta pra dentro do banco é outra discussão, e mover as duas
  coisas juntas é como perder a chance de saber qual delas quebrou.
- Mudar qualquer coisa na planilha — incluindo o `call_id` (ver §Pendências).

## Arquivos afetados (esboço)

| Arquivo | Mudança |
|---|---|
| `src/lib/fonte.ts` | novo — `lerDeals()`, `lerLigacoes()`… + leitura da flag + shadow read |
| `src/lib/ingest/repo.ts` | + os SELECTs que devolvem `RawDeal[]` etc. (mesma forma do gviz) |
| `db/migrations/0004_config.sql` | novo — tabela `config` (chave/valor) pra flag |
| rotas de API | trocam `fetchFromSheets('x')` por `lerX()` — **uma linha cada** |
| testes | o adaptador devolve a MESMA forma nas duas fontes, com o mesmo fixture |

O teste que importa: **a mesma linha, lida das duas fontes, produz o mesmo objeto**. Se isso vale,
a virada é seguro por construção.

## Pendências herdadas da Fase 1

Os 3 achados foram **decididos em 29/07**: viram baseline explícito, sem tocar na planilha
(detalhe e aritmética no atestado). O portão está **7/7 verde com 4 ressalvas**.

O que ainda falta para o relógio dos 7 dias começar a contar:

| Pendência | Por quê |
|---|---|
| credencial `Defenz Ingest Token` no n8n | sem ela os nós tomam 401 e o Neon congela no backfill |
| deploy desta branch | `/api/ingest` só existe em produção depois que ela subir |

Enquanto essas duas não acontecerem, o portão fica vermelho por **defasagem** (a planilha anda
a cada cron, o Neon não), não por defeito — e reexecutar o backfill à mão a cada vez não conta
como portão verde.

**Um achado da Fase 1 continua aberto como risco, mesmo baselinado:** o `call_id` colidido faz
o `appendOrUpdate` sobrescrever uma ligação com os dados de outra — a planilha **perde dado
sozinha**, a cada execução. Não bloqueia a Fase 2 (é 0,04% do volume), mas é dívida real e
cresce com o volume. Corrigir isso é mudança sentida, então fica para uma janela combinada.
