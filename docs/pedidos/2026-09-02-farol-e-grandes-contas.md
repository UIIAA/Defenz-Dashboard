# Pedido à sessão Dashboard — farol e Grandes Contas

**De:** sessão Chief (Defenz_Chief) · **Para:** sessão `Defenz - Dashboard`
**Data:** 02/09/2026 · **Origem:** reunião de gestão de 31/08 e pedido do Marcos de 02/09
**Encaminhamento do Marcos:** spec primeiro, implementação depois.

---

## Por que este pedido chega de fora

Na reunião de 31/08 o Fernando pediu quatro ajustes na tela do farol. Três deles são tela, e
tela é de vocês. Eles entraram na spec `feature-039-pendentes.md` do Chief como itens 1, 2 e 3, e
o Marcos decidiu em 01/09 que o item 2 sai da fila do Chief inteiro e o item 3 fica partido:
o diagnóstico do dado é meu, a correção da tela é de vocês.

Este documento junta os três com o pedido novo do Marcos sobre Grandes Contas, para vocês
escreverem uma spec só.

---

## O que eu já vi do lado de vocês

Li antes de escrever, para não pedir o que já existe:

- `src/lib/oportunidades.ts` usa **denylist** para `isAberto`, e o comentário registra que
  `Grandes Contas` sumiu da v1 da spec por causa de allowlist. A denylist já resolve o
  aparecimento; o que falta é a separação.
- `src/lib/donos.ts` **já mapeia `vendor 2` (id `7067822000000576001`) para "Leonardo"** e
  `Gustavo Figueira` para "Gustavo F", por id e não por nome. O commit `c75e697` levou
  `owner_id` e `owner_nome` do Zoho até o Neon.
- Ou seja: a infraestrutura de dono já está de pé. O pedido do Francisco é uma regra por cima
  dela, não um campo novo.

---

## Pedido 1 · Janela padrão vira o último dia útil, com escolha de data

**Hoje:** janela fixa de sete dias.
**Fernando pediu:** o padrão ser o **último dia útil**, com possibilidade de escolher a data.
**Aceite:** abrir a tela numa segunda-feira mostra a sexta, não a semana inteira; trocar a data
recarrega o recorte.

## Pedido 2 · Filtro que separa Grandes Contas do restante

**Hoje:** os negócios em tratativa aparecem misturados. Na reunião foram citados 68 em tratativa,
dos quais cerca de 30 são Grandes Contas.
**Fernando pediu:** conseguir ver **só o quente e o morno comuns**, para tratar da mesma forma,
sem as Grandes Contas no meio.
**Marcos pediu em 02/09:** que dê para **filtrar apenas por elas** e também **separá-las das
demais**. São dois modos, não um: isolar e excluir.
**Aceite:** com o filtro em "sem Grandes Contas", o total bate com o total geral menos a contagem
de Grandes Contas. Os três estados somam ao total.

## Pedido 3 · O corte bater com o número das demais telas

**Hoje:** o Fernando apontou divergência entre o número do farol e o de outra tela, citando "53"
contra o número do pipe.
**Pedido:** diagnóstico de onde nasce a diferença (recorte de estágio, recorte de data ou
paginação) e correção na fonte que estiver errada.
**Aceite:** os dois números conciliam, ou existe uma linha na tela dizendo por que diferem.
**Aviso:** o `GET /Deals` do Zoho já mordeu antes por paginação. Vale checar isso antes de mexer
na conta. Se o diagnóstico apontar para o lado do Chief, me chamem que eu corrijo lá.

## Pedido 4 · Grandes Contas aparecem com o nome do Francisco

**Hoje:** os negócios em `Stage = Grandes Contas` mostram o dono que veio do Zoho.
**Marcos pediu:** que apareçam com o nome do **Francisco**.

### O detalhe que faz esse pedido não ser trivial

**No CRM esses negócios estão no dono errado.** As 39 Grandes Contas foram criadas em agosto por
carga de lista, sob o usuário genérico `vendor 2` (`7067822000000576001`), que o `donos.ts` de
vocês mapeia para **"Leonardo"**. Elas não são do Leonardo e nunca foram: são a carteira do
Francisco.

Consequências práticas:

1. **Mapear por `owner_id` não resolve este caso**, porque o `owner_id` está errado na origem. A
   regra que funciona é **por estágio**: `Stage = Grandes Contas` → dono exibido = Francisco.
2. **Isso hoje polui a contagem do Leonardo.** Qualquer tela que conte negócios por dono está
   somando 39 cartões que não são dele. Foi um erro que eu quase cometi num levantamento ontem, e
   o Marcos pegou.
3. Vale decidir junto com o Marcos se a correção certa é só de exibição ou se é **arrumar o dono
   no Zoho**. Exibição resolve a tela; arrumar a origem resolve a tela e todo o resto. Minha
   recomendação é arrumar na origem, e a exibição por estágio ficar como rede de segurança para
   o que entrar errado no futuro.

**Aceite:** os cartões de Grandes Contas mostram Francisco; a contagem por dono do Leonardo cai
em 39; e o filtro do pedido 2 continua batendo.

---

## O que eu entrego do meu lado

- O **diagnóstico do pedido 3**, dizendo qual dos dois números está certo e por quê. Isso sai da
  f-037, que roda no Chief.
- A confirmação de que o `Stage = Grandes Contas` está preenchido e estável nos 39 registros.
- Se a decisão for arrumar o dono no Zoho, eu faço a correção na origem e aviso vocês.

## O que eu não vou fazer

Não mexo em tela do Dashboard. O farol da f-037 continua sendo meu: rotina
`trig_011sEigb988eF7H1UqaJK1ha` e workflow n8n `609dj477lHEPBX6J`, que grava `Temperatura` no
Zoho com a trava de convivência (valor mexido por gente não é sobrescrito). Se a spec de vocês
precisar de mudança nesse lado, me peçam em vez de duplicar a leitura.

---

## Contexto que talvez ajude na spec

- O farol do Chief cobre **só os cinco estágios do pipe aberto** (Em negociação, Em Trial/POC,
  Reunião Técnica, Proposta Enviada, Proposta/Governo). **Grandes Contas está fora dele**, ou
  seja, esses 39 cartões não têm temperatura automática hoje. Se a tela for separar Grandes
  Contas, vale mostrar isso explicitamente em vez de deixar o cinza parecer "ninguém classificou".
- Na reunião ficou registrado que Contato Futuro é geladeira e tem gatilho datado próprio, o que
  bate com o `GELADEIRA` que já está no `oportunidades.ts`.
