# Defenz Dashboard — Resumo Executivo

> **Data:** 2026-07-13
> **Status:** Em produção (`defenz-dashboard.vercel.app`)
> **Escopo deste resumo:** Farol de Metas (Fases 1 e 2), separação de fonte de receita, e a fila de próximos passos.

---

## Resumo Executivo

Hoje o dashboard passou a responder duas perguntas de gestão que antes exigiam olhar planilha ou fazer conta de cabeça: **"tô batendo a meta da semana/mês?"** e **"por que bati (ou não bati)?"**. Além disso, resolvemos um problema de atribuição que distorcia essas respostas: vendas **repassadas prontas pela SecuriSoft** estavam sendo contadas junto com vendas que a **equipe efetivamente trabalhou**, inflando o resultado sem relação com o esforço comercial. Isso já está separado.

---

## O que foi implementado

### 1. Farol de Metas (`/diario`)
Um indicador sempre visível no topo do Resumo Diário, mostrando a receita da **semana** e do **mês** contra a meta de **R$ 6.000/semana**, com um semáforo de ritmo (verde/amarelo/vermelho) que considera em que dia da semana estamos — não é só "bateu ou não", é "está no ritmo esperado pra essa altura da semana".

### 2. Página `/metas` — "Por que bati / não bati"
Nova página dedicada que pega a **última semana fechada** e explica o resultado cruzando com o esforço comercial daquela semana (ligações, e-mails, apresentações, propostas, reuniões) comparado com a semana anterior. Em vez de só mostrar o número, aponta a causa: por exemplo, *"Meta não batida — Emails caiu 76% e Reuniões caiu 67%"*. Também traz um gráfico comparativo das últimas 8 semanas.

### 3. Separação Repasse SS × Venda Defenz
Este foi o ajuste mais importante do dia. Hoje, **91% da receita fechada** vem de negócios de origem SecuriSoft — mas dentro desse grupo há dois casos bem diferentes:
- A SecuriSoft **vendeu e simplesmente repassou** o contrato pra Defenz (sem esforço comercial nosso).
- A SecuriSoft passou um **lead**, e a **nossa equipe trabalhou** a venda até fechar (esforço nosso conta).

Sem separar os dois, a meta de R$6k podia "bater" só com repasse — o que mascara se a equipe está performando ou não. Agora:
- A meta de R$ 6.000/semana conta **só a receita que a equipe trabalhou**.
- O repasse SS aparece **à parte, de forma informativa** (não conta pra meta, mas segue visível).
- **A marcação de qual é qual acontece no Zoho**, através de uma tag em cada negócio (`Venda Defenz`). Sem a tag, o sistema assume — por padrão — que é repasse (opção mais conservadora, evita inflar o resultado por engano).

> **Efeito já confirmado:** uma semana que aparecia como "meta batida" só por causa de um repasse pontual passou a mostrar corretamente "meta não batida" assim que a separação entrou no ar — prova de que o número agora reflete esforço real.

### 4. Seletor de intervalo de datas unificado
O calendário de seleção de datas (usado no Resumo Diário e no dashboard executivo/operacional) foi unificado num único componente. Antes existiam duas implementações fazendo a mesma coisa de formas ligeiramente diferentes; hoje é uma só, o que reduz risco de bugs futuros e deixa o comportamento consistente entre as telas.

### 5. Regra de dados: valor do negócio sempre vem do Montante do Zoho
Ficou documentado formalmente (no manual técnico do projeto) que o valor de qualquer negócio, para fins de métricas e metas, **sempre vem do campo "Montante" do Zoho** — nunca de estimativas. Se um negócio "Fechado Ganho" aparecer com valor zero no dashboard, o problema está no Montante vazio no Zoho, não no sistema; a correção lá reflete automaticamente no próximo ciclo de atualização (6h/18h).

---

## Ação pendente (depende do Marcos)

Para a separação Repasse × Venda Defenz funcionar com precisão, é preciso **marcar no Zoho os negócios de origem SecuriSoft que a equipe efetivamente trabalhou**, usando a tag **`Venda Defenz`**. Sugestão: começar por um único negócio para validar que a migração de "Repasse" para "Venda Defenz" acontece corretamente no dashboard, depois seguir com o restante.

---

## Próximos passos (fila priorizada)

| # | Item | Descrição | Status |
|---|------|-----------|--------|
| 1 | Ligações de IA | Nova aba dedicada às chamadas feitas pelo agente de vendas por IA (volume, resultado, conversão) — hoje esse dado não está integrado ao dashboard. | Spec em rascunho, aguardando investigação da fonte de dados. |
| 2 | Timeline / raio-x por negócio | Linha do tempo por cliente cruzando o histórico de atividades registradas no CRM — permite abrir um negócio e ver a jornada completa. | Spec em rascunho. |
| 3 | Ajustes finos do Resumo Diário | Destaques operacionais agrupados pelas categorias reais do dia a dia (Comercial/Gestão/Geral), e captura automática do link da ata de reunião. | Aprovado, pausado — retomar quando priorizado. |

Itens técnicos de menor prioridade (token do Microsoft Calendar expirado zerando reuniões, backfill histórico de 120 dias, domínio próprio) seguem na fila, sem urgência.

---

## Nota sobre o processo de desenvolvimento

Para reduzir custo sem abrir mão de qualidade, features maiores passaram a ser implementadas em duas etapas: um modelo mais econômico faz a implementação "braçal" (código, testes), e uma segunda passada revisa de verdade — relê o código, roda os testes de novo, testa a tela no navegador — antes de qualquer coisa ir ao ar. Essa segunda etapa já pegou e corrigiu pelo menos um erro real antes do deploy nesta sessão.
