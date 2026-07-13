# Spec (aterrissada) — Aba "Ligações de IA" (Defenz Dashboard)

> **Origem:** pedido do Marcos ("uma aba só de ligações de IA"). Aterrissada contra o código real (13/07/2026).
> **Definição (do Marcos):** "ligações de IA" = **chamadas outbound feitas pelo agente de voz de vendas** (SDR/Sales AI), não as ligações humanas do Callbox (essas já vivem na aba `ligacoes`).
> **Status:** Draft — enfileirada (ver `PLANO-farol-timeline.md`). Não implementar antes de aprovar + resolver os itens abertos.

## 1. Objetivo
Uma aba dedicada mostrando as **ligações feitas pela IA de vendas**: volume, resultado (atendida/agendou/recusou), conversão, duração e custo — separada das ligações humanas. Responde: "a IA está ligando quanto, e isso está virando reunião/deal?"

## 2. Realidade do código / fontes (o que existe)
| Peça | Onde | Observação |
|---|---|---|
| Ligações **humanas** (Callbox) | aba `ligacoes` (doc `1roir…`), populada pelo `Coleta Métricas v2` (`QjnzGicZHIPBNN1g`) | fresca; **não** é IA |
| Pipeline de **IA de vendas** | workflow `Defenz Sales AI - Post Call → Zoho CRM` (`Lj9Aaw63cpqLGI4q`, ativo) | grava resultado da call de IA no Zoho |
| SDR por voz (Retell) | `Defenz SDR - Call Results (Retell AI)` (`sqcJzfUEp6C26Y4D`, **inativo**) | fonte histórica/alternativa |
| Dashboard lê **Sheets**, não Zoho direto | `src/lib/sheets.ts` | ⇒ precisa de um **export novo** pro Sheets |

**Conclusão de arquitetura:** o dado de ligações de IA hoje **não está no Sheets** — vive no Zoho (escrito pela Sales AI). A aba precisa de: (1) um **export n8n** Zoho→Sheets numa aba nova `ligacoes_ia`, espelhando o padrão do `ligacoes`/`Format Deals Raw`; (2) API + página no Vercel.

## 3. Arquitetura (aditiva, espelha o que já existe)
```
Zoho (calls da Sales AI)  ──[novo nó/branch no n8n QjnzGicZHIPBNN1g OU workflow próprio]──▶  aba `ligacoes_ia` (doc 1roir…)
                                                                                                    │ gviz público
                                                                                                    ▼
GET /api/ligacoes-ia  →  computeLigacoesIA(rows, range)  →  página /ligacoes-ia (tema Lux)
```
Reuso: `fetchFromSheets`, `DateRangePicker` (intervalo já pronto), cache 30min, padrão de card/tabela.

## 4. Data contract — aba `ligacoes_ia` (proposta, a confirmar contra o Zoho)
`call_id | data (YYYY-MM-DD) | hora | empresa | contato | telefone | duracao_seg | status (atendida|nao_atendida) | resultado (agendou|interessado|recusou|callback|caixa_postal) | agente_ia | deal_id (opcional) | custo (opcional) | gravacao_url (opcional) | transcricao_resumo (opcional)`
> Ordem/nomes a fechar depois de inspecionar a saída real da Sales AI (item aberto).

## 5. Tela `/ligacoes-ia`
- **Cards:** total de ligações IA · taxa de atendimento · nº que agendou/converteu · duração média · (custo total, se houver).
- **Série temporal:** ligações IA por dia no intervalo (reusa `DateRangePicker`).
- **Tabela:** por ligação (data, empresa, status, resultado, duração, link gravação) com filtro por resultado.
- **Comparativo (opcional):** IA vs humano (Callbox) no mesmo período.
- Tema Lux (branco+vermelho), padrão do resto do app.

## 6. Faseamento
1. **Export n8n** Zoho→`ligacoes_ia` (confirmar campos reais primeiro) + criar a aba com cabeçalho.
2. **Vercel:** `src/lib/ligacoes-ia.ts` (agregação pura + testes), `GET /api/ligacoes-ia`, página `/ligacoes-ia` + link no navbar.
3. (futuro) Comparativo IA×humano; custo/ROI por ligação.

## 7. Itens abertos (resolver na implementação)
- [ ] **Inspecionar a saída real da Sales AI no Zoho** (módulo Calls? campos custom? Retell?) → fechar o schema da §4.
- [ ] Export próprio (workflow novo) vs branch no `QjnzGicZHIPBNN1g` (preferência: workflow próprio, isolado, como o Snapshot Diário).
- [ ] Volume/histórico disponível (desde quando há ligações de IA?).
- [ ] Rota `/ligacoes-ia` vs reaproveitar `/atividade` (stub).
