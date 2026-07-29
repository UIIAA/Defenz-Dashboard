# Atestado de Consistência de Dados — 28/07/2026

> Tarefa da **Ata da Reunião de Gestão Comercial 28/07** — Responsável: Marcos ·
> Prazo: antes do corte · Pré-requisito da data de corte.
> Decisão 2 da ata: *dashboard considerado em produção, validação de consistência segue em paralelo.*

## Nota sobre o escopo da tarefa

A tarefa foi registrada como *"atestar a consistência dos dados entre Google Sheets e Neon"*.
Na prática **os dois sistemas são disjuntos** — não há registro que exista nos dois para reconciliar:

| Sistema | O que guarda |
|---|---|
| **Google Sheets** (`1roirh1RRFg8…`) | dado de negócio: deals, ligações, e-mails, leads, classificação IA, agenda, snapshot diário |
| **Neon** (`ep-divine-math-ac1adibo`) | **apenas** autenticação e config: `users`, `access_log`, `channel_targets` |

Portanto o atestado cobre o que de fato determina a confiabilidade do número exibido:
**(A)** integridade do Sheets, **(B)** integridade do Neon, **(C)** o que o dashboard calcula
bate com a fonte, e **(D)** riscos residuais.

---

## A. Google Sheets — íntegro ✅

**Aba `deals`** (fonte de receita, comissão e base instalada)
- 219 linhas · **0 ids duplicados** · **0 linhas sem id** (chave `id` confiável para o upsert)
- 67 ganhos (`Fechado Ganho` + `Contrato Enviado`) · soma de licenças **5.919**
- **0 ganhos com valor 0** — ou seja, nenhum `Amount` vazio no Zoho (falha clássica do Farol)
- 1 ganho sem licença registrada (`N_de_Endpoints` vazio no Zoho) — impacto desprezível

**Aba `resumo_diario`** (snapshot diário)
- 47 linhas · intervalo **2026-05-19 → 2026-07-28** · **0 datas duplicadas**
- **Cobertura completa de dias úteis nos últimos 21 dias** — nenhum dia útil sem registro

**Abas lidas pelo dashboard — todas existem e têm schema próprio**
`deals` (219) · `ligacoes` (11.529) · `emails` (3.786) · `classificacao_ia` (1.116) ·
`leads` (1.418) · `resumo_diario` (47) · `agenda` (279).

## B. Neon — íntegro ✅

- Tabelas: `users`, `access_log`, `channel_targets`
- 4 usuários ativos · **1 admin** (`marcos@defenz.com.br`) — ver risco D2
- `channel_targets`: 3 canais criados, **todos zerados** (metas ainda não definidas — ver D3)
- `access_log`: 8 eventos, último em 28/07 14:39 · **0 órfãos** (todo `user_id` referencia um usuário existente)
- **Produção e local apontam para o MESMO banco** (`ep-divine-math-ac1adibo…/neondb`), então a
  migração aplicada vale para os dois. `DATABASE_URL` e `AUTH_SECRET` presentes na Vercel.

## C. Dashboard × fonte — reconcilia ✅

Rodada a função real `aggregateBaseInstalada()` sobre a planilha de produção e comparada com o
snapshot independente gravado pelo workflow `aMhvdTP5aAi0Z1sf`:

| Métrica | Dashboard (calculado da aba `deals`) | Snapshot `resumo_diario` 28/07 | Confere |
|---|---|---|---|
| Clientes ativos | 67 | 67 | ✅ exato |
| Total de licenças | 5.919 | 5.919 | ✅ exato |
| Setup concluído | 43% (29 de 67 na console) | — | ✅ coerente |

São **dois caminhos de cálculo independentes** (o dashboard agrega a aba `deals`; o snapshot
consulta o Zoho direto) chegando ao mesmo número — é a evidência mais forte do atestado.

---

## D. Achados e riscos

### D1. 🐞 CORRIGIDO — reuniões infladas no relatório mensal

`/api/relatorio-mensal` lia a aba `reunioes` com `fetchFromSheetsNullable`. **A aba `reunioes` não
existe**, e o gviz responde HTTP 200 devolvendo silenciosamente a *sheet 0* (= `ligacoes`). Resultado:
as **11.529 ligações entravam em `computeMetrics`/`bucketizeByWeek` como se fossem reuniões**,
inflando a métrica de reuniões do relatório mensal.

`/api/dashboard-sheets` **não** tinha o problema — já usava `fetchTabStrict("reunioes", ["data","assunto"])`,
que valida a coluna-assinatura e corretamente devolve `null` → fallback para o proxy `[REUNIAO]`.

**Correção aplicada (28/07):** `relatorio-mensal` passou a usar o mesmo `fetchTabStrict`. Não há mais
nenhum consumidor de `fetchFromSheetsNullable` no código.

> **Regra para o futuro:** ao ler uma aba que pode não existir, use **sempre** `fetchTabStrict` com uma
> coluna-assinatura. `fetchFromSheets`/`fetchFromSheetsNullable` não distinguem "aba ausente" de
> "sheet 0", e a falha é **silenciosa** — não gera erro, gera número errado.

### D2. ⚠️ ABERTO — papel `owner` não existe (risco de governança)

`Role` é plano (`admin | member`). Qualquer admin pode desativar a conta de outro admin ou resetar a
senha dele — inclusive a do Marcos. Não há "admin não mexe em admin" nem proteção de auto-desativação.
**Mitigação temporária:** só existe 1 admin hoje (Fernando foi rebaixado a `member` de propósito).
**Pendente:** spec do papel `owner` (owner > admin > member).

### D3. ⚠️ ABERTO — metas por canal zeradas

`channel_targets` está com os 3 canais em 0. Enquanto não forem preenchidas (pelo lápis na tela `/`,
como admin), a seção "Receita por Canal" não exibe barra de atingimento nem o consolidado.
Não é inconsistência de dado — é configuração pendente.

### D4. ℹ️ Informativo — abas `reunioes` e `metricas` não existem

- `reunioes`: por design. A integração com o Microsoft Calendar está indisponível (token expirado, P4);
  as reuniões são derivadas de `[REUNIAO]` no campo `Resultados` dos deals. Coberto por `fetchTabStrict`.
- `metricas`: os nós que a alimentavam (`Consolidar`, `Split/Sheets Metricas`) estão **desabilitados de
  propósito** — o dashboard calcula as métricas em `src/lib/metrics.ts` a partir das abas raw.
  Nenhum código lê a aba `metricas`. **Não reabilitar** os nós.

### D5. ℹ️ Corrigido em 28/07 — coleta incompleta e perda de gravação

Dois problemas encontrados e resolvidos no mesmo dia (detalhe em `NOVA_ARQUITETURA_N8N.md` §7):
- o nó `Zoho Deals` do workflow de coleta **não paginava** — só os 200 deals mais recentes eram
  atualizados, o que fazia a base instalada somar 3.346 em vez de 5.919 licenças;
- o nó `IA Classificar` derrubava a execução inteira num `503` transitório do Gemini, custando a
  gravação do turno (3 turnos perdidos em 22–23/07).

---

## Conclusão

**Os dados estão consistentes e o dashboard pode ser considerado em produção.** A verificação mais
importante — dois caminhos de cálculo independentes chegando a 67 clientes e 5.919 licenças — passou
com igualdade exata, e a cobertura de dias úteis do snapshot está completa.

Um defeito real foi encontrado e corrigido durante esta validação (**D1**, reuniões infladas no
relatório mensal). Restam dois itens abertos que **não são inconsistência de dado**: o papel `owner`
(**D2**, governança) e as metas por canal zeradas (**D3**, configuração).

**Ressalva de método:** esta validação foi feita por inspeção de dados e execução da lógica real de
agregação contra a planilha de produção. **Não inclui conferência visual das telas logadas** — isso
depende de acesso autenticado e continua pendente.

---

*Gerado em 28/07/2026. Fontes: planilha `1roirh1RRFg8Pfg7iFO9-rp9xtMgPCbQBuMpsOQGZoZQ`,
banco Neon `neondb`, workflows n8n `QjnzGicZHIPBNN1g` e `aMhvdTP5aAi0Z1sf`.*
