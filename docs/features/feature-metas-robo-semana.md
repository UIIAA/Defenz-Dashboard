# Spec — Farol 100% no /metas + coluna Robô no /diario + filtro de semana (Seg–Sex)

> **Origem:** pedidos do Marcos na sessão de 2026-07-13 (conversa vai ser resetada; continuar por esta spec).
> **Status:** Draft aprovado nas decisões-chave (ver §Decisões). **Nada implementado ainda** — só investigação feita. Spec-first: revisar e então implementar.
> **Base:** o Farol de Metas Fase 1+2 + separação de fonte de receita JÁ está em produção (`main` @ `e580552`). Esta spec são os AJUSTES em cima disso. Contexto profundo na memória local `farol-metas-fase1-2.md`.

## Onde estamos (o que já está no ar)
- `/diario` (Resumo Diário): tabela "Por Canal / Responsável" (linhas: Telefonia, E-mail, WhatsApp, LinkedIn, Apresentações, Propostas, Reunião técnica; colunas: Gustavo, Leonardo, Marcos/Sup.) + cards + Tração Diária + Destaques. **Tem hoje o card `<FarolCard>` (semana+mês) no topo** — que vai SAIR daqui.
- `/metas` (Farol de Metas): "Semana Atual" + "Por que bati/não bati" (última semana fechada) + comparativo 8 semanas + **separação Venda Defenz × Repasse SS** (meta conta só Venda Defenz; ver `feature-metas-fonte-receita.md`).
- Libs reusáveis prontas: `src/lib/farol.ts` (`computeFarol` semana+mês, `grade`, helpers de semana exportados), `src/lib/metas.ts` (`computeMetas`, `weekRevenue` split defenz/repasse, `weeklyEsforco`, diagnóstico), `src/lib/date-range.ts` + `src/components/ui/DateRangePicker.tsx` (seletor 1-clique=dia / 2=intervalo).

## Decisões (travadas com o Marcos, 2026-07-13)
| # | Decisão |
|---|---|
| Farol | Sai do `/diario`, vai **100% pro `/metas`** — semana **E mês** (tudo que o Farol mostra). |
| Robô | Coluna nova "Robô" na tabela do `/diario`. Fonte = **Callbox, ramal 102**. |
| Semana | **Seg–Sex** para esforço/ritmo (Sáb/Dom não contam no esforço). |
| Receita fim de semana | **Mantida** — janela de atribuição segue Seg→Dom (nada se perde); só o esforço é Seg-Sex. Deal fechado no sáb/dom conta na semana daquele fim de semana. |
| Filtro /metas | **Intervalo livre (várias semanas)** — reusar o `DateRangePicker`; ver o consolidado somado + retrospecto semana a semana. |

## 1. Mover o Farol do /diario → /metas (semana + mês)
- **Remover** o `<FarolCard>` do topo do `/diario` (`src/components/diario/ResumoDiarioDashboard.tsx`). O resto do /diario fica igual.
- **Adicionar no /metas** o Farol completo (semana **e mês**) — `computeFarol(deals, now)` já entrega os dois buckets (`semana`, `mes`) com meta/pace/cor. Hoje o /metas só mostra a semana; trazer também o **MÊS** (meta mensal: Σ semanas cuja segunda cai no mês → Jul=4→R$24k, Ago=5→R$30k).
- Consolidar o layout do /metas pra não repetir "semana" duas vezes (o card do Farol e o "Semana Atual" do Fase 2 se sobrepõem — unificar num header só de semana + um de mês).

## 2. Coluna "Robô" na tabela "Por Canal / Responsável" (/diario)
**Fato confirmado (Marcos + probe da collection Callbox 2026-07-13):** o robô de ligações disca pelo **Callbox no ramal 102** ("Suporte <102>"). **TODAS as chamadas do ramal 102 são do robô** — não precisa distinguir de suporte humano.

**Findings da collection Callbox** (endpoint `POST /callbox-api/relatorios/bilhetagem/tab_chamadas`, cred do node "Callbox Login" do snapshot `aMhvdTP5aAi0Z1sf`):
- Campo `origin` = `"Nome <ramal>"`. Ramais: **100 = Leonardo Alves · 101 = Marcos Cruz · 102 = Suporte/ROBÔ · 103 = Gustavo** (Fernando Souza = outro ramal). Números crus sem nome = chamadas externas/entrantes.
- Campos por chamada: `origin, date ("DD-MM-YYYY HH:MM:SS"), status ("Atendida"/"Nao Atendida"), disposition, event ("Atendimento"/"Falha"), duration, identification, destiny, interface, uniqueid, userfield`.

**Mudança:**
- Na tabela do /diario, **linha Telefonia** ganha a coluna **"Robô"** (o robô só faz ligação — nas outras linhas fica em branco/—). O robô hoje cai no bucket "Suporte"/"Marcos/Sup." → **separar num bucket próprio** pra não somar junto.
- **Dado (LIVE):** o snapshot `aMhvdTP5aAi0Z1sf` node **Parse Ligacoes** já lê o Callbox ao vivo via `origin` (tem o `<102>`). Mapear **ramal 102 → bucket "Robô"** no `ligacoes_por_vendedor` (o `VMAP` atual mapeia por nome: gustavo/leonardo/marcos; adicionar detecção do ramal `<102>` → "Robô"). Marcos autorizou usar um workflow existente pra puxar ou criar novo.
- **Dado (HISTÓRICO):** a aba `ligacoes` do Sheets só guarda `agente` (o nome, sem ramal) → o robô vira "Suporte", indistinguível em dias passados. Pra separar histórico: adicionar coluna `ramal` no export **`Format Ligacoes Raw`** (workflow `QjnzGicZHIPBNN1g`) — decisão aberta (ver §Abertos).

## 3. Filtro de intervalo (várias semanas) no /metas
- Reusar o **`DateRangePicker`** (mesmo componente do /diario). Selecionar um intervalo → mostrar o **consolidado somado** do período + o **retrospecto semana a semana** (o comparativo já existe, hoje fixo em 8 semanas; passar a respeitar o intervalo selecionado).
- **Meta do intervalo** = R$6.000 × nº de semanas (Seg-Sex) no intervalo.
- O "por que bati/não bati" sobre um intervalo de várias semanas: consolidar (somar esforço e receita do período) OU manter por-semana no comparativo — decidir no layout (ver §Abertos).

## 4. Semana = Seg–Sex
- Esforço/ritmo medido **Seg–Sex**. Já é quase o comportamento atual: o pace do Farol rampa Seg 8h→Sex 23:59 e trata Sáb/Dom como overtime. Ajustar pra que o **esforço** (ligações/emails/apres/propostas/reuniões do `resumo_diario`) na visão semanal também seja Seg-Sex.
- **Receita:** manter a janela Seg→Dom (deal de sáb/dom conta na semana). Nada muda em `weekRevenue`/`sumWon` (já usam a semana Seg-Dom via `mondayOf`+6).

## Arquivos afetados (mapa pro implementador)
| Área | Arquivos |
|---|---|
| Farol sai do /diario | `src/components/diario/ResumoDiarioDashboard.tsx` (remover `<FarolCard>`) |
| Robô na tabela /diario | `ResumoDiarioDashboard.tsx` (`PorCanalTable` → coluna Robô), `src/lib/resumo-diario.ts` (parse `por_vendedor` com bucket Robô), n8n `aMhvdTP5aAi0Z1sf` node Parse Ligacoes (ramal 102→Robô), tipos em `types.ts` |
| Farol semana+mês no /metas | `src/components/metas/MetasDashboard.tsx`, reusa `src/lib/farol.ts` |
| Filtro de semanas /metas | `MetasDashboard.tsx` (+ `DateRangePicker`), `src/lib/metas.ts` (`computeMetas` por intervalo), `src/app/api/metas/route.ts` |
| Semana Seg-Sex (esforço) | `src/lib/metas.ts` (`weeklyEsforco` filtrando Seg-Sex) + testes |
| Robô histórico (opcional) | n8n `QjnzGicZHIPBNN1g` node `Format Ligacoes Raw` (+ coluna `ramal` na aba `ligacoes`) |

## Itens abertos (decidir na implementação)
1. **Histórico do robô:** adicionar `ramal` ao export de ligações (separa dias passados) **vs** só daqui pra frente (live)? (Recomendo adicionar `ramal` — barato e desbloqueia o histórico.)
2. **Coluna "Marcos/Sup." atual:** com o Robô saindo do bucket, ela vira "Marcos" só? Confirmar o layout final da tabela (Gustavo · Leonardo · Marcos · Robô?).
3. **Robô: total + atendidas** (como os vendedores) ou só total de ligações?
4. **Layout /metas** com Farol(semana+mês) + por-que-bati + comparativo + fonte-de-receita + filtro de intervalo — desenhar pra não poluir/duplicar.
5. **"Por que bati/não bati" num intervalo de várias semanas:** consolidado do período ou por-semana? 

## Notas de segurança
- Callbox: usar as credenciais do node **"Callbox Login"** do snapshot (não colocar senha em código/repo). API: login `POST /callbox-api/login` → token no campo `data`; calls `POST /callbox-api/relatorios/bilhetagem/tab_chamadas` com Bearer, body `{filter_start_date, filter_end_date, page}` (datas `YYYY-MM-DD`, `page` no body).
