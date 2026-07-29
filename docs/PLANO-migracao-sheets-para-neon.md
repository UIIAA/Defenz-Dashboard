# Plano — Migrar a fonte de dados do Google Sheets para o Neon

> **Status: PROPOSTA — não aprovada, não iniciada.** Escrito em 28/07/2026 a pedido do Marcos.
> Não confundir com [`project_future_no_n8n`](../../.claude/memory) — aquele é sobre **abandonar o n8n**.
> Este é sobre **onde o dado mora**, e os dois eixos são independentes.

## Dois eixos, não um

| Eixo | Hoje | Alvo |
|---|---|---|
| **Onde o dado mora** | Google Sheets | **Neon (Postgres)** ← este plano |
| **Quem busca o dado** | n8n (Zoho/Apollo/Callbox/Microsoft/Gemini) | n8n (mantido) |

**O n8n permanece.** Ele tem nó nativo de Postgres — a mudança é trocar o destino da escrita, não
reescrever a ingestão. Isso derruba drasticamente o custo e o risco da migração.

## Por que sair do Sheets — evidência, não teoria

Todos os itens abaixo foram observados **em produção, em 28/07/2026**:

1. **Falha silenciosa de aba inexistente.** O gviz responde HTTP 200 devolvendo a *sheet 0* quando o
   nome da aba não existe. Isso fez ~11.529 ligações serem contadas como reuniões no relatório mensal
   (ver `ATESTADO_CONSISTENCIA_2026-07-28.md` §D1). No Postgres, `select … from reunioes` numa tabela
   inexistente é **erro**, não número errado.
2. **Sem schema.** A coluna `licencas` precisou ser digitada à mão no cabeçalho; até isso acontecer,
   o valor era descartado sem nenhum aviso.
3. **Sem transação nem constraint.** O `appendOrUpdate` casando por `lead_id` podia sobrescrever
   classificação boa com `erro_parse` — foi preciso um guard em código para evitar.
4. **Paginação manual.** O nó de coleta trazia só os 200 deals mais recentes; a base instalada somava
   3.346 em vez de 5.919 licenças.
5. **Sem query.** Para contar ligações de um período o dashboard baixa **11.529 linhas (~2,9 MB)** e
   filtra em JS. Um `count(*) where data between …` resolveria no servidor.
6. **Sem tipo.** Tudo volta como string; cada consumidor faz `Number(...) || 0` por conta própria.

## O que já está pronto a favor

- Neon **já está no stack e em produção** — `users`, `access_log`, `channel_targets` moram nele.
- `DATABASE_URL` e `AUTH_SECRET` **já configurados na Vercel**; produção e local usam o mesmo banco.
- Já existe padrão de migration versionada (`db/migrations/`) e runner (`scripts/users.mjs migrate`).
- Já existe a camada fina `src/lib/db.ts` (Neon lazy) e o padrão de repo em `src/lib/users.ts`.

Ou seja: **a fundação existe**. Isto é ampliar um padrão que já funciona, não introduzir tecnologia nova.

---

## Etapas

Cada etapa deixa o projeto rodável e é reversível. Nunca há um "big bang".

### Etapa 0 — Decisão de escopo
Definir quais abas migram e quais não. Proposta:

| Aba | Linhas | Migra? |
|---|---|---|
| `deals` | 219 | ✅ sim — núcleo (receita, comissão, base instalada) |
| `ligacoes` | 11.529 | ✅ sim — a que mais sofre com volume |
| `emails` | 3.786 | ✅ sim |
| `leads` | 1.418 | ✅ sim |
| `classificacao_ia` | 1.116 | ✅ sim |
| `agenda` | 279 | ✅ sim |
| `resumo_diario` | 47 | ✅ sim — snapshot histórico |
| exports/planilhas manuais | — | ❌ não — Sheets continua ótimo para consumo humano |

**Entrega:** escopo aprovado. **Risco:** nenhum.

### Etapa 1 — Schema no Neon
Criar as migrations (`db/migrations/0003_dados.sql`+) com tipos reais, chaves e índices:
`deals(id pk, stage, valor numeric, closing_date date, licencas int, …)`, índices por data e por stage.
Constraints que o Sheets nunca teve (`not null`, `check`, `unique`).

**Entrega:** tabelas vazias no Neon. **Risco:** nenhum — nada lê delas ainda.

### Etapa 2 — Escrita dupla no n8n
Cada nó `Sheets *` ganha um irmão `Postgres *` escrevendo o mesmo dado no Neon (`insert … on conflict
do update`). **O Sheets continua sendo a fonte da verdade**; o Neon é sombra.

**Entrega:** dado fluindo para os dois. **Risco:** baixo — se a escrita no Neon falhar, o dashboard
não sente (ninguém lê dali ainda).

### Etapa 3 — Validação de paridade (automatizar o atestado)
Uma rota/script que compara Sheets × Neon: contagem por tabela, soma de licenças, soma de valor,
datas cobertas. É exatamente o atestado de 28/07, só que **automático e recorrente**.

**Entrega:** relatório de paridade verde por N dias seguidos. **Risco:** nenhum — só leitura.
**Este é o portão:** não se avança sem paridade estável.

### Etapa 4 — Migrar a leitura, rota a rota
Trocar `fetchFromSheets("deals")` por query SQL, **uma rota por vez**, começando pela de menor risco
(`/api/base-instalada`) e terminando na de maior (`/api/dashboard-sheets`). Cada rota vira um PR com
teste comparando o resultado novo × antigo.

Aqui aparece o ganho real: filtro de período vira `WHERE`, agregação vira `SUM`/`COUNT`, e o payload
cai de megabytes para bytes.

**Entrega:** dashboard lendo do Neon. **Risco:** médio — mitigado por rota-a-rota + paridade da Etapa 3.

### Etapa 5 — Neon vira a fonte da verdade
Backfill do histórico completo do Sheets para o Neon (uma vez). O Sheets passa a ser **derivado**:
o n8n continua escrevendo nele apenas para consumo humano/export.

**Entrega:** Neon canônico. **Risco:** baixo — a leitura já vinha do Neon desde a Etapa 4.

### Etapa 6 — Desligar a escrita no Sheets *(opcional)*
Só se ninguém mais abrir a planilha na mão. Vale manter um export periódico Neon → Sheets se a
equipe usa a planilha para trabalhar.

**Entrega:** um único destino de escrita. **Risco:** organizacional, não técnico.

---

## O que isso desbloqueia

- **Filtros e comparações que hoje são inviáveis** — período contra período, coorte, janela móvel,
  tudo em SQL em vez de baixar a planilha inteira.
- **Fim de uma classe inteira de bug** — aba errada, coluna faltando, tipo string, sobrescrita silenciosa.
- **Histórico de verdade** — hoje o `resumo_diario` é a única memória; no Postgres dá para versionar
  o estado de cada deal ao longo do tempo.
- **Base para o eixo 2** — se um dia o n8n sair, a Vercel já escreve num banco que ela conhece.

## Custo e limites

- **Neon:** o plano atual comporta este volume folgado (as tabelas maiores têm ~11k linhas). Sem custo novo previsto.
- **Esforço:** as etapas 1–3 são as baratas; a 4 é a que consome tempo (uma rota por vez).
- **Não resolve:** qualidade do dado na origem. Se o `Amount` está vazio no Zoho, continua vazio no Postgres.

## Recomendação

Fazer **0 → 3 primeiro** e parar para avaliar. Ao fim da Etapa 3 já existe paridade demonstrada e
o atestado de consistência vira automático — e nada em produção mudou. A decisão de seguir para a
Etapa 4 fica muito mais informada com esse dado na mão.
