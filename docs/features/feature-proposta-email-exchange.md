# Spec — Proposta enviada medida na caixa de e-mail (Exchange)

> **Status: v2, revisada com as decisões do Marcos de 27/08/2026.** Nada implementado.
> Medição que sustenta cada número daqui: sessão de 27/08/2026, memória
> `proposta-email-exchange`. Insumo direto das duas métricas de proposta decididas em 26/08.

## Objetivo

Passar a ler os **e-mails enviados pelo time** como fonte primária de duas coisas:

1. **"Proposta enviada"** — a métrica de atividade decidida em 26/08, hoje alimentada por um
   extrator de chat que erra nos dois sentidos.
2. **Última atividade real do negócio** — o sinal que sustenta os avisos da tela.

O segundo item é o que o Marcos pediu como "margem e segurança sobre os avisos", e é a parte que
não tem substituto: **os campos de atividade do Zoho estão mortos**. Medido em
[`feature-semaforo-oportunidades.md`](feature-semaforo-oportunidades.md): `modified_time` dá a
mesma data para 19 de 30 negócios abertos, e `Last_Activity_Time` tem **3 datas distintas entre
26 negócios**. Alguma automação toca todos os registros e apaga o sinal.

O e-mail enviado é o único sinal de atividade que a casa produz e que **não pode ser falsificado
por automação**: ou o documento saiu, ou não saiu, com hora e destinatário.

## Por que não dá para consertar as fontes atuais

| fonte de hoje | o que ela responde | por que não serve para aviso |
|---|---|---|
| estágio do Zoho | posição no funil | muda quando o vendedor lembra de mover; não é atividade |
| tag `[PROPOSTA]` no `resultados` | o vendedor anotou | anotação, não envio; e o campo já truncou em silêncio antes |
| extrator do chat (Chief) | alguém relatou | **contou 0 num dia com 2 propostas**, e 4 num dia com 3 |
| `modified_time` / `Last_Activity_Time` | nada | medidos mortos (acima) |

## Escopo

**Dentro:** coleta dos enviados de 4 caixas, classificação determinística, gravação no Neon,
métrica "Proposta enviada" e campo de última atividade externa.

**Fora:** ler caixa de entrada; ler corpo de e-mail; qualquer uso de LLM; a caixa do Fernando
(**decidido: não incluir**); desligar as fontes atuais — elas continuam e passam a ser comparadas
contra o e-mail.

## Decisões travadas

1. **Sem LLM.** Regra determinística sobre metadado. LLM extrai, JS calcula — aqui não há nada
   para extrair, o dado já é estruturado.
2. **Só metadado.** Grava remetente, destinatários, assunto, data/hora, `hasAttachments` e
   **nomes** dos anexos. Nunca o corpo. Não baixa anexo.
3. **Só a pasta de enviados.** Não se lê caixa de entrada de ninguém. §Proposta do canal explica
   por que isso é suficiente.
4. **Quatro caixas:** os dois Gustavos (Figueira e Barbosa), Leonardo e Marcos.
5. **Reaproveitar o caminho de ingestão que já existe** — o n8n não fala com o Postgres direto,
   faz `POST /api/ingest` e o TypeScript valida. Mapeamento na UI do n8n já falhou em silêncio
   duas vezes.
6. **O e-mail não precisa de negócio no Zoho** *(Marcos, 27/08)*. Ver §Identidade.
7. **Autenticação app-only desde a Fase 1** *(revisado — ver §Custo do app-only)*.
8. **Falha ruidosa.** E-mail que a regra não classifica com confiança não é descartado. Ver
   §Falha ruidosa. Lição de `sheets-perde-escrita-silencio`.

## Fonte e coleta

```
GET https://graph.microsoft.com/v1.0/users/{upn}/mailFolders/sentitems/messages
  ?$select=internetMessageId,subject,sentDateTime,from,toRecipients,ccRecipients,hasAttachments
  &$expand=attachments($select=name,contentType,size)
  &$filter=sentDateTime ge {inicio} and sentDateTime lt {fim}
  &$top=100
```

### Autenticação

A credencial delegada que já existe (`microsoftOutlookOAuth2Api` "Marcos@Defenz") **já enxerga as
quatro caixas** — testado em 27/08, HTTP 200. Serve para desenvolver e medir sem esperar nada.

Mas a coleta de produção usa **app-only** desde o primeiro dia. Motivo: OAuth delegado numa conta
humana é exatamente o que matou a métrica de reuniões (P4) — o token expira e a métrica some sem
avisar. É o risco de maior probabilidade da tabela e o custo de eliminá-lo é ~1h uma vez só.

### Janela

Janela por `sentDateTime` com **retrolook de 1 dia**, `hoje` calculado em `America/Sao_Paulo`
(não UTC) — mesma disciplina da coleta incremental já em produção. Backfill por parâmetro
explícito.

### Cadência

Junto ao cron que já existe (6h/12h/18h). Quatro chamadas por execução, ~1s cada.

## Regra de classificação

**Um e-mail é "proposta enviada" quando:**

```
(  algum anexo é PDF e o nome do anexo casa /proposta/i
OR o assunto casa /proposta/i  )
AND existe ao menos um destinatário (to+cc) que não é @defenz.com.br
    nem domínio de parceiro (securisoft.com.br)
```

### Por que precisa dos dois lados

Medido em agosto, os dois erros acontecem em sentidos opostos:

| caso | assunto | anexo | o que é |
|---|---|---|---|
| Alvorada do Sul, 27/08 | `RE: Apresentação Bitdefender GravityZone` | `Proposta Defenz DFZ-2026-02009.pdf` | proposta — só o anexo denuncia |
| Barbosa Mello, 14/08 | `Proposta Bitdefender GravityZone` | `apresentacao-Barbosa-Mello.pdf` | proposta — só o assunto denuncia |

Regra só por assunto pegaria 9 de 19 na caixa do Figueira. Regra só por anexo perde Barbosa Mello.

### Por que domínio de parceiro sai da conta

O Miller **pede para ser copiado** nas propostas — medido em 25/08, Abi-Ackel: *"por favor me
coloco em cópia na proposta que for enviar para esse cliente"*. Se `securisoft.com.br` contasse
como destinatário externo, toda proposta com ele em cópia contaria também para a SecuriSoft como
se ela fosse cliente. A lista de domínios de parceiro é explícita e versionada.

### Por que o filtro de domínio interno não é detalhe

Dos 11 candidatos na caixa do Leonardo, **2 eram encaminhamentos internos** para o Gustavo. Sem o
filtro, encaminhamento vira proposta e o número infla.

### As cinco convenções que a regra precisa cobrir

```
Proposta Defenz DFZ-2026-02009.pdf        numerado — só a partir de 20/08
Proposta Comercial - Water Services.pdf   Figueira, até 19/08
Proposta-Agroserra.pdf                    Barbosa
Proposta_Comercial_Redencao.pdf           Leonardo
apresentacao-Barbosa-Mello.pdf            sem "proposta" no nome — cai pelo assunto
```

`/proposta/i` no nome cobre as quatro primeiras independente de hífen, underscore ou espaço. A
quinta depende do assunto — por isso o `OR` existe.

## Identidade

### Do e-mail

**`internetMessageId`** é a chave natural. **Não usar o `id` do Graph**: ele muda quando a
mensagem é movida de pasta, e a mesma mensagem reingerida viraria linha nova.

### Do negócio — deliberadamente frouxa

**Decisão do Marcos (27/08): o e-mail não precisa estar vinculado a empresa nem a negócio.**

O motivo é de processo, não técnico: **a proposta muitas vezes sai antes de o cliente virar
negócio no Zoho.** Exigir o vínculo criaria uma fila de "erros" que não são erros — é o fluxo
normal da casa.

Consequências:

- `empresa_id` e `deal_id` são **enriquecimento opcional**, preenchidos quando dá, nulos quando
  não dá, e **nulo não gera pendência**.
- **Não existe fila de revisão por falta de vínculo.** Some da spec a preocupação com os ~10% de
  clientes em Gmail/Proton — eles simplesmente ficam sem vínculo, e está certo assim.
- Domínio genérico (gmail, hotmail, proton, …) **nunca** vira chave de empresa. Lista explícita.
- Quando o negócio aparece no Zoho depois, o vínculo pode ser preenchido retroativamente por
  domínio. É melhoria, não pré-requisito.

### Contagem — por destinatário e por dia

A unidade da métrica é **(destinatário externo, dia)**, não o e-mail e não o negócio. Isso cai
direto das decisões do Marcos:

| caso medido | conta | por quê |
|---|---|---|
| **LDV Net, 21/08** — 3 PDFs numerados num e-mail (3 opções de plano) | **1** | mesma mensagem, mesmo cliente, mesmo dia |
| **Agroserra, 19 e 24/08** — mesmo arquivo, 5 dias de intervalo | **2** | *"pode ser uma atualização de proposta com esse espaçamento de dias — deve contar uma a cada dia"* |
| **Faculdade Baiana, 25/08** — Barbosa e Leonardo, mesmo destinatário, arquivos diferentes | **1** | mesmo cliente, mesmo dia, dois remetentes |
| **Renovação** (Abi-Ackel, Localizadora) | **conta** | *"proposta mesmo pra quem quer renovar é proposta"* |

O último caso é o que torna a chave por destinatário necessária: sem ela, dois vendedores
tratando o mesmo cliente no mesmo dia contariam duas propostas.

## Proposta do canal

**Não é um teto.** A hipótese de que a SecuriSoft envia proposta ao cliente por fora não se
sustenta na medição: em agosto o Miller mandou 6 e-mails para o Gustavo, **nenhum deles proposta
a cliente**, e o de 25/08 pede explicitamente para ser copiado na proposta que a Defenz vai
enviar. O fluxo medido é **Defenz → cliente, com Miller em cópia** — e isso a caixa de enviados
já pega.

Fica registrado como limite conhecido, sem aviso na tela: se um dia o fluxo inverter e o parceiro
passar a enviar direto, a métrica subcontaria em silêncio. O sinal disso seria queda de propostas
sem queda de vendas.

## Modelo de dados

Fato plano e append-only, seguindo a regra de modelagem da migração (dimensão normaliza, fato
não).

```sql
create table if not exists emails_enviados (
  internet_message_id  text primary key,
  caixa                text not null,          -- upn da caixa lida
  remetente            text not null,
  destinatarios        text[] not null,        -- to + cc, minúsculo
  dominios_cliente     text[] not null,        -- externos, sem defenz nem parceiro nem genéricos
  destinatarios_cliente text[] not null,       -- base da chave de contagem
  assunto              text,
  enviado_em           timestamptz not null,
  tem_anexo            boolean not null,
  anexos               text[],                 -- só nomes
  eh_proposta          boolean not null,
  motivo_classificacao text,                   -- 'anexo' | 'assunto' | 'ambos'
  proposta_ref         text,                   -- 'DFZ-2026-02009' quando existir
  empresa_id           bigint references empresas(id),   -- opcional, nulo é normal
  deal_id              text references deals(id),        -- opcional, nulo é normal
  motivo_revisao       text,                   -- só para quase-proposta; NÃO para falta de vínculo
  ingerido_em          timestamptz not null default now()
);

create index on emails_enviados (enviado_em desc);
create index on emails_enviados (deal_id, enviado_em desc);
create index on emails_enviados (eh_proposta, enviado_em desc) where eh_proposta;
create index on emails_enviados (motivo_revisao) where motivo_revisao is not null;
```

Upsert por `internet_message_id`. Reingestão da janela de retrolook é idempotente.

`motivo_classificacao` existe para auditar a regra depois: se um dia 90% vier por `assunto`, a
convenção de nome de anexo mudou e ninguém avisou.

## Contrato da ingestão

Nova tabela na rota que já existe: `POST /api/ingest` com `{ tabela: "emails_enviados",
execucao, linhas }`, header `X-Ingest-Token`, máximo 500 linhas por requisição, transacional por
lote, erro por linha em `erros: [{linha, campo, motivo}]`. Linha inválida é rejeitada e reportada
— **nunca coagida**. Mesmas garantias das 7 tabelas atuais.

E-mail sem negócio resolvido **não é órfão e não é erro** — é o caso normal (§Identidade).

## Uso na tela

### 1. Métrica "Proposta enviada"

Vem de `emails_enviados` onde `eh_proposta`, agregada por `(destinatário cliente, dia)` no
período. O extrator do chat **sai da soma** e vira só sinal de divergência — coerente com a
decisão de 26/08 de que ele nunca pode ser parcela.

O ⓘ já decidido ganha uma linha: de onde veio o número.

### 2. Última atividade externa — o item que o Marcos pediu

Campo derivado: `ultima_atividade_externa = max(enviado_em)` dos e-mails com destinatário
cliente. **Todos**, não só proposta — cobrança de retorno também é atividade.

Isso troca a base dos avisos: hoje "parado há N dias" se apoia em campo que não se move de
verdade; passa a se apoiar em "a casa falou com o cliente pela última vez em tal dia". Um negócio
só é sinalizado como parado quando **nenhuma** fonte viva registrou contato — e-mail enviado,
ligação (Callbox) ou mudança de estágio.

Onde não há negócio no Zoho, o sinal vive na empresa/domínio e serve igual — a proposta que saiu
antes do negócio existir é justamente a que ninguém acompanha hoje.

### 3. Quem trabalhou o negócio — o `Owner` do Zoho não responde isso

O campo `Owner` chegou ao Neon em 27/08 (`owner_id`/`owner_nome`, commit `c75e697`). Ele é **dono
do registro no CRM**, não quem vendeu. Medido no mesmo dia:

- Existem **dois** owners em 300 negócios: `Gustavo Figueira` (178) e `vendor 2` (122).
- `vendor 2` é a conta genérica `suporte@defenz.com.br` — **compartilhada**, não uma pessoa.
- **Gustavo Barbosa tem zero negócios como owner**, e é vendedor desde 28/04/2026 (347 e-mails
  enviados). As propostas que ele mandou em agosto estão sob `vendor 2` (Precision, Faculdade
  Baiana, Barbosa Mello) e sob `Gustavo Figueira` (Agroserra).

Ou seja: três das quatro pessoas que comprovadamente enviam proposta (Barbosa, Leonardo, Marcos)
são invisíveis ou estão fundidas numa conta compartilhada.

**O remetente do e-mail é o único sinal medido de quem trabalhou o negócio.** `emails_enviados`
já guarda `remetente`, então a atribuição por pessoa sai de graça desta fonte — e é atribuição por
ato (mandou a proposta), não por titularidade de registro.

Isso **não** substitui arrumar o Zoho; é o que dá para medir enquanto não arruma.

### 4. Comparação, não substituição

As três fontes continuam gravadas e a tela mostra a divergência quando existir. Regra da casa:
**divergência se investiga, não se ajusta o comparador**.

⚠️ **Contaminante conhecido do lado do Zoho, medido em 27/08 pela sessão `5c`:** o negócio
`TESTE MCP - ignorar` (id `7067822000006619001`, criado 22/06) foi removido do Zoho mas continua
no Neon e na aba, no estágio `Proposta Enviada` — o `appendOrUpdate` nunca apaga, então negócio
excluído fica órfão para sempre. O Zoho devolve 299 negócios; a aba e o Neon têm 300. Valor 0,
não suja dinheiro, mas **infla "Cliente com proposta" de 11 para 12**.

Isso importa aqui por dois motivos:

1. Na Fase 2, uma divergência de 1 entre funil e e-mail em agosto é **esse órfão**, não a fonte
   nova errando. Investigar já sabendo disso poupa a caçada.
2. A métrica de e-mail é **imune** a esse defeito — ela não lê a tabela de negócios. É um
   argumento a favor da fonte, não uma coincidência.

O conserto do órfão é de outra frente (limpeza do `appendOrUpdate`), não desta spec.

## Falha ruidosa

O modo de falha recorrente deste projeto é **perder dado em silêncio** — a planilha comendo
escrita (R$ 19.962 errados na comissão de agosto), o `resultados` truncando os 1000 chars mais
antigos, o token do Calendar expirando.

1. **Quase-proposta.** E-mail com anexo PDF para destinatário cliente que **não** casou a regra é
   registrado com `eh_proposta = false` e `motivo_revisao = 'anexo pdf externo nao classificado'`.
   É assim que a próxima mudança de convenção de nome aparece **antes** de virar buraco.
2. **Coleta zerada.** Caixa que retorna zero mensagem numa execução em dia útil é alerta — é a
   assinatura do token/permissão quebrada, não de um dia parado.
3. **Deriva de classificação.** Se a proporção `motivo_classificacao = 'assunto'` saltar, a
   convenção de anexo mudou.

## Privacidade

Ler a caixa do time é monitoramento e tem que ser tratado como tal.

- Escopo mínimo: **só enviados, só metadado, sem corpo, sem baixar anexo**.
- **Avisar Figueira, Barbosa e Leonardo antes de ligar.** Não é opcional.
- Assunto e nome de anexo podem conter nome de cliente — o Neon já guarda isso, mas **nada disso
  vai para a memória compartilhada nem para o repositório**.
- A caixa do Fernando fica de fora por decisão explícita do Marcos.

## Custo do app-only

Trabalho de uma vez, **R$ 0 de licença**, tudo com acessos que o Marcos já tem (Global Admin +
Exchange Admin):

| passo | tempo |
|---|---|
| Registrar app no Entra ID (client id + secret) | ~10 min |
| Permissão de **aplicação** `Mail.Read` + consentimento de admin | ~5 min |
| Grupo de segurança mail-enabled com as 4 caixas | ~10 min |
| `New-ApplicationAccessPolicy` restringindo o app a esse grupo (Exchange Online PowerShell) | ~20 min na primeira vez, contando instalar o módulo |
| Credencial client-credentials no n8n + trocar no nó | ~15 min |
| **total de trabalho** | **~1h** |
| espera de propagação da política | até 1h, sem intervenção |

O único passo com atrito real é o PowerShell — o módulo `ExchangeOnlineManagement` roda no macOS
via `pwsh`, e é o único jeito de criar a política (não existe equivalente no portal).

**Recomendação: fazer na Fase 1, não na Fase 3.** Uma hora agora elimina o risco de maior
probabilidade da tabela, cujo modo de falha é silencioso. Deixar para depois significa construir
a métrica em cima de um token que já provou que expira.

## Riscos

| risco | probabilidade | impacto | mitigação |
|---|---|---|---|
| Convenção de nome muda de novo | alta — mudou dia 20/08, no meio do mês medido | subcontagem | guarda 1 (quase-proposta) |
| Permissão/credencial quebra | média com app-only (era **alta** com delegado) | métrica zera | guarda 2 (coleta zerada) |
| O número muda e alguém acha que é bug | certa | desconfiança na tela | rodar em paralelo (Fase 2) antes de trocar o número exibido |
| Vendedor manda proposta de outra caixa/pessoal | baixa | subcontagem | guarda 2 não pega; aceito |
| Fluxo do canal inverte (parceiro passa a enviar direto) | baixa hoje | subcontagem silenciosa | §Proposta do canal |

## Fases

**Fase 1 — coletar e gravar.** App-only, nó no n8n, tabela no Neon, ingestão. **Nada muda na
tela.** Pronto quando: 7 dias corridos coletando as 4 caixas sem furo, e a lista de
quase-propostas explicada item a item.

**Fase 2 — mostrar em paralelo.** "Proposta enviada" e `ultima_atividade_externa` aparecem ao
lado dos números atuais, com a divergência visível. Pronto quando: o Marcos olhar a divergência
de um mês fechado e concordar com a explicação de cada item.

**Fase 3 — virar a chave.** E-mail vira a fonte de "Proposta enviada" e dos avisos; o chat vira
só sinal. Pronto quando: os avisos da tela pararem de se apoiar em `modified_time`.

## Decisões registradas (Marcos, 27/08/2026)

- LDV Net, 3 PDFs num e-mail → **1 proposta**.
- Agroserra, mesmo arquivo em 19 e 24/08 → **2** — reenvio com dias de intervalo é atualização de
  proposta, conta uma por dia.
- Renovação → **conta como proposta**.
- Vínculo com empresa/negócio → **não é obrigatório**, porque a proposta costuma sair antes do
  negócio existir no Zoho.
- Teto do canal → **não declarar na tela**; a medição mostrou que a proposta do canal sai da
  caixa da Defenz mesmo.
