# Spec — `/metas` legível: KPI autoexplicativo, gráficos unificados e meta em verde

> **v1 — 04/08/2026. Status: aguardando aprovação.**
> Origem: revisão do painel na reunião. Escopo pequeno e todo de leitura/apresentação —
> nenhuma regra de cálculo de receita muda.

## 1. O KPI que ninguém entende — "233%" e "190"

O tile é **Reunião → proposta**, e o valor é `propostas ÷ reuniões` exibido como porcentagem:
`42 ÷ 18 = 2,33 → 233%`. O "190" é o mesmo tile em outro período (`1,9 → 190%`).

**A causa não é o número, é o par rótulo+formato.** O nome promete uma *taxa de conversão* —
que por definição fica entre 0 e 100% — e a fórmula entrega um *multiplicador*. Percentual
acima de 100% em algo chamado conversão é confuso por construção, e nenhuma legenda conserta.

**Correção:** exibir como razão, sem `%`.

| hoje | vira |
|---|---|
| Reunião → proposta · **233%** | Propostas por reunião · **2,3** |
| Reunião → proposta · **190%** | Propostas por reunião · **1,9** |

Os quatro tiles ganham uma linha curta de leitura, porque "autoexplicativo" é o pedido:

| tile | linha de leitura |
|---|---|
| Ticket médio | quanto vale, em média, cada venda fechada |
| R$ / proposta | quanto de receita cada proposta enviada gerou |
| Propostas / 100 ligações | quantas propostas saem a cada 100 ligações |
| Propostas por reunião | quantas propostas cada reunião gera |

A fração crua (`42 propostas ÷ 18 reuniões`) continua embaixo — ela é o que torna o número
auditável.

## 2. Meta em verde — com uma ressalva que precisa de decisão

Hoje a linha de meta é cinza (`#64748b`) e **verde significa "batido"**. Foi decisão anterior
registrada: *dado é neutro; verde/âmbar/vermelho são status; vermelho só para problema real*.

Pintar a meta de verde faz verde significar duas coisas na mesma tela: "meta" e "batido".

**Recomendação:** linha de meta em **verde tracejado** (é referência, não status) e o
atingimento continua na **cor da barra** (grafite = bateu · cinza médio = ≥80% · cinza claro =
abaixo). A legenda passa a dizer isso com todas as letras.

Alternativa, se preferir verde exclusivo para meta: o status sai da cor e vira selo textual.
É mais mudança e não recomendo agora.

**Isto é decisão sua** — implemento a recomendação salvo instrução contrária.

## 3. Unificar o gráfico 3 no gráfico 1

Ordem atual na tela:

1. **Receita Defenz vs Meta** — barras de receita + linha de meta
2. **Direcionado SS** — barras, informativo
3. **Esforço → Vendas** — barras de receita + linha de esforço (eixo direito) + os 4 tiles

O gráfico 3 repete as mesmas barras de receita do gráfico 1. **Unificar = trazer a linha de
esforço para o gráfico 1**, no eixo direito. Sobram dois gráficos, e os 4 tiles de eficiência
viram bloco próprio logo abaixo (eles são a parte que orienta decisão; não são gráfico).

Cada gráfico ganha uma linha de legenda explicando o que mostra e o que **não** mostra —
principalmente o Direcionado SS, que hoje não diz que está fora da meta.

## 4. "vs 8 semanas anteriores" em destaque

Hoje é 11px `slate-400` no rodapé do bloco de eficiência. É a informação que dá sentido a
todos os deltas — sem ela os `+12%` não querem dizer nada.

Vira **cabeçalho do bloco**, no mesmo tamanho dos outros títulos de seção.

## 5. Ligações do robô — o dado JÁ EXISTE, não precisa alimentar à mão

Medido na aba `resumo_diario`, coluna `ligacoes_por_vendedor`, que guarda por dia:

```json
{"Robô":{"realizadas":409,"atendidas":257},"Gustavo":{...},"Leonardo":{...}}
```

Julho, dias úteis:

| | realizadas | atendidas | taxa |
|---|---:|---:|---:|
| **Robô** | 2.232 | 1.302 | 58% |
| **Equipe** | 1.733 | 878 | 51% |
| total | **3.965** | 2.180 | 55% |

O total bate exatamente com `ligacoes_total`. O que falta é só **exibir** — o `/metas` mostra
"Ligações 3.965" sem separar.

**Divergência de 14 ligações** para o fechamento manual (que diz Robô 2.246 / Equipe 1.719):
é a linha **Suporte** (14 realizadas, 14 atendidas, 100%), contada como robô no fechamento e
como equipe aqui. Não é erro de dado — é definição. **Decidir onde Suporte entra.**

Proposta: o tile de Ligações passa a mostrar `equipe + robô` com a taxa de cada um, já que a
taxa é o que diferencia (51% × 58%).

## 6. Linha do tempo do cliente

Já existe spec: [`feature-timeline-cliente.md`](feature-timeline-cliente.md). Não reescrever —
revisar e priorizar. Fora do escopo desta.

## Pendente de esclarecimento

**"Corrigir somatórios e a lógica dinâmica de comparação das semanas"** — dois somatórios já
foram corrigidos nesta semana: o consolidado passou a ser a soma exata das barras, e a janela
virou calendário puro (01–31/07 deixou de significar 29/06–02/08). **Preciso saber qual soma
ainda não fecha** — sem isso eu estaria adivinhando.

## Fora de escopo

Nenhuma regra de receita, atribuição de data ou classificação de origem muda. Esta spec é
inteiramente de leitura: rótulo, cor, ordem e agregação já calculada.
