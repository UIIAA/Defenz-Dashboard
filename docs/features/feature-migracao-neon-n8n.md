# Patch n8n — escrita dupla Sheets → Neon (feature-migracao-neon, Fase 1)

> Complemento operacional da spec [`feature-migracao-neon.md`](feature-migracao-neon.md).
> **Estado: pronto pra aplicar, NÃO aplicado.** Validado em dry-run (`validateOnly`) contra a
> instância. Falta: (1) o `INGEST_TOKEN` existir como credencial no n8n, (2) sua autorização.

## Correção da spec: são 2 workflows, não 1

A spec diz "n8n `QjnzGicZHIPBNN1g` | + 7 nós HTTP". Conferido contra o estado real: esse workflow
grava **6** das 7 abas. A sétima (`resumo_diario`) é gravada pelo workflow
**`aMhvdTP5aAi0Z1sf` — "Defenz - Dashboard - Snapshot Diário"** (cron 17h50), que é outro fluxo.

| Tabela | Workflow | Nó âncora (o HTTP entra depois dele) | Aba |
|---|---|---|---|
| `deals` | `QjnzGicZHIPBNN1g` | `Sheets Deals` | `deals` |
| `ligacoes` | `QjnzGicZHIPBNN1g` | `Sheets Ligacoes Raw` | `ligacoes` |
| `emails` | `QjnzGicZHIPBNN1g` | `Sheets Emails Raw` | `emails` |
| `leads` | `QjnzGicZHIPBNN1g` | `Sheets Leads Completo` | `leads` |
| `classificacao_ia` | `QjnzGicZHIPBNN1g` | `Sheets Classificacoes` | `classificacao_ia` |
| `agenda` | `QjnzGicZHIPBNN1g` | `Sheets Agenda` | `agenda` |
| `resumo_diario` | `aMhvdTP5aAi0Z1sf` | `Write Row` | `resumo_diario` |

## Por que 2 nós por tabela, e não 1

A spec previu "+7 nós HTTP". Na prática são **2 nós por tabela**: o nó HTTP do n8n dispara **uma
requisição por item**, e `ligacoes` tem 11,5k itens — seriam 11,5k requisições em vez de 24. O nó
`Code` anterior agrupa os itens em lotes de 500 (o teto da rota) e emite um item por lote.

```
Sheets <X>  →  Code "Lote → Neon: <x>"  →  HTTP "Ingest → Neon: <x>"
   (intocado)     agrupa em lotes de 500      POST /api/ingest
```

**Nenhum nó existente é alterado, removido ou desabilitado.** Os dois nós novos têm
`onError: continueRegularOutput`: se o Neon cair, a execução segue e o Sheets — que é a fonte da
verdade — não é afetado. Falha de Neon nesta fase é ruído, não incidente.

## Pré-requisito: credencial

Criar no n8n uma credencial **Header Auth** (`httpHeaderAuth`), mesmo padrão da já existente
"Chief Fernando Write Token":

- **Nome:** `Defenz Ingest Token`
- **Header Name:** `X-Ingest-Token`
- **Header Value:** o valor de `INGEST_TOKEN` (o mesmo da Vercel)

Sem ela os 7 nós HTTP respondem 401 — inofensivo (o `onError` absorve), mas nada chega no Neon.

## Nós — `QjnzGicZHIPBNN1g` (6 tabelas)

Para cada `<x>` em `deals · ligacoes · emails · leads · classificacao_ia · agenda`:

**Code — `Lote → Neon: <x>`** (`n8n-nodes-base.code` v2, `onError: continueRegularOutput`)

```js
// feature-migracao-neon Fase 1 — escrita dupla. O Sheets segue sendo a fonte da verdade.
// Este ramo NUNCA pode afetar o Sheets: onError = continueRegularOutput aqui e no HTTP.
const LOTE = 500;
const linhas = $input.all().map(i => i.json);
const out = [];
for (let i = 0; i < linhas.length; i += LOTE) {
  out.push({ json: { tabela: '<x>', execucao: $execution.id, linhas: linhas.slice(i, i + LOTE) } });
}
return out;
```

**HTTP — `Ingest → Neon: <x>`** (`n8n-nodes-base.httpRequest` v4.2, `onError: continueRegularOutput`)

```jsonc
{
  "method": "POST",
  "url": "https://defenz-dashboard.vercel.app/api/ingest",
  "authentication": "genericCredentialType",
  "genericAuthType": "httpHeaderAuth",   // credencial "Defenz Ingest Token"
  "sendBody": true,
  "specifyBody": "json",
  "jsonBody": "={{ JSON.stringify($json) }}",
  "options": { "timeout": 60000 }
}
```

Conexões: `Sheets <X>` → `Lote → Neon: <x>` → `Ingest → Neon: <x>`.

## Nó — `aMhvdTP5aAi0Z1sf` (resumo_diario)

Este é diferente: o nó `Build Row` emite `{ target, row_values: [...] }` — um **array posicional de
32 células**, não um objeto. Posição é contrato invisível: inserir uma coluna no meio desloca tudo
e o número errado entra sem ninguém ver. Por isso a ordem está fixada em
`COLUNAS_ROW_VALUES` (`src/lib/ingest/schema.ts`) **com teste** que a confere contra as origens
declaradas — se o `Build Row` mudar e a lista não, o teste quebra antes do dado entrar torto.

**Code — `Lote → Neon: resumo_diario`** (âncora: depois de `Write Row`; lê os dados de `Build Row`,
porque a saída do `Write Row` é a resposta da API do Sheets, não a linha)

```js
// Ordem POSICIONAL do Build Row. Mantenha em sincronia com COLUNAS_ROW_VALUES
// em src/lib/ingest/schema.ts (há teste conferindo a lista de lá).
const COLS = ['data','atualizado_em','mode','coverage','ligacoes_total','ligacoes_atendidas',
  'ligacoes_taxa','ligacoes_por_vendedor','emails_total','emails_por_sender','apresentacoes_total',
  'apresentacoes_por_vendedor','propostas_total','propostas_por_vendedor','reuniao_tecnica_total',
  'reuniao_por_vendedor','whatsapp_msgs','whatsapp_convs','linkedin_page','linkedin_perfis',
  'pocs_ativas','pocs_lista','base_total_licencas','base_clientes_ativos','base_top_contas',
  'base_demais_count','base_demais_licencas','total_tracao','destaque_comercial',
  'destaque_marketing','destaque_execucao','destaque_atencao'];

const linhas = $('Build Row').all().map(item => {
  const r = item.json.row_values;
  if (!Array.isArray(r) || r.length !== COLS.length) {
    throw new Error('row_values com ' + (Array.isArray(r) ? r.length : '?') +
                    ' posições — esperado ' + COLS.length + '. O Build Row mudou?');
  }
  return Object.fromEntries(COLS.map((c, i) => [c, r[i]]));
});

return [{ json: { tabela: 'resumo_diario', execucao: $execution.id, linhas } }];
```

O nó HTTP é idêntico ao das outras tabelas.

Conexões: `Write Row` → `Lote → Neon: resumo_diario` → `Ingest → Neon: resumo_diario`.
(`Write Row` → `Done` continua existindo — o ramo novo é paralelo.)

## Ordem de chegada e a FK de `leads`

`classificacao_ia` e `agenda_tarefas` têm FK real pra `leads`. No workflow, `Sheets Classificacoes`
e `Sheets Agenda` rodam em ramos **paralelos** ao de `leads` — então, na primeira execução, uma
classificação de um lead **novíssimo** pode chegar antes do lead.

Isso **não é bug e não perde dado**: a rota rejeita a linha reportando
`lead <id> ainda não ingerido`, e a execução seguinte (6h depois) grava normalmente, porque o
`Zoho Leads` reenvia a base inteira a cada run. O backfill inicial já roda `leads` primeiro.

O que olhar nos primeiros dias: se `rejeitados` de `classificacao_ia`/`agenda` **não** cair pra
perto de zero depois do segundo run, aí sim tem algo errado — investigar, não ajustar.

## Como aplicar

Via MCP (`n8n_update_partial_workflow`), 4 operações por tabela (2 `addNode` + 2 `addConnection`).
O patch de `deals` já passou em `validateOnly: true`.

## Depois de aplicar — o portão

```bash
curl -s -H "X-Ingest-Token: $INGEST_TOKEN" \
  https://defenz-dashboard.vercel.app/api/ingest/paridade | jq
```

7 dias corridos de `"veredito": "verde"` nas 7 tabelas fecham a Fase 1.
**Divergência se investiga — não se ajusta o comparador.**
