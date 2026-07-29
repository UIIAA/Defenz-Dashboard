# Dívidas técnicas — Defenz Dashboard

> Registro vivo. Última verificação: **28/07/2026** — cada item abaixo foi **conferido contra o
> estado real** (banco, Vercel, código, git) nesta data, não copiado de anotação antiga.
> Ao sanar uma dívida, mover para o §Sanadas com a data e o commit.

Ordem = risco, não esforço.

---

## 🔴 Alta

### D-01 · Papéis são planos — um admin pode derrubar outro admin

**O que é.** `Role = 'admin' | 'member'`, sem hierarquia. As ações do `/admin`
(`toggleActiveAction`, `resetPasswordAction`, `createUserAction`) não checam o papel do **alvo**.

**O que arrisca.** Qualquer admin pode **desativar a conta do Marcos** ou **trocar a senha dele** e
assumir o acesso. Não há "admin não mexe em admin" nem proteção contra auto-desativação.

**Mitigação atual — frágil.** Existe **1 único admin** (Fernando foi rebaixado a `member` de
propósito em 28/07). A dívida vira incidente no minuto em que uma segunda pessoa precisar de
poderes de gestão.

**Como sanar.** Spec do papel `owner`: `owner` > `admin` > `member`; só o owner cria/promove/rebaixa
admins; conta owner não pode ser desativada nem ter senha resetada por admin; ninguém se
auto-desativa. Decidido em 28/07 que entra **depois** da migração para o Neon.

**Onde.** `src/lib/users.ts` (tipo `Role`), `src/app/admin/actions.ts`, `src/middleware.ts`,
migration para o novo valor do papel.

---

### D-02 · Nenhuma tela foi conferida visualmente

**O que é.** As 4 features do lote de julho (`/metas` v2, Receita por Canal, drill-down da base
instalada, indicador de setup) foram validadas por **teste automatizado, tipo, build e conferência
de dados** — mas **nunca abertas em um navegador logado**.

**O que arrisca.** Erro puramente visual (quebra de layout, contraste, texto cortado, estado vazio
feio) passaria despercebido. A lógica está coberta; a aparência não.

**Por que não foi feito.** Exige sessão autenticada, e o assistente não faz login em nome do Marcos.

**Como sanar.** Marcos abre as 4 telas com dado real e reporta. Alternativa: habilitar um caminho de
verificação que não exija credencial do usuário.

---

## 🟡 Média

### D-03 · `fetchFromSheetsNullable` continua no código, sem nenhum consumidor

**O que é.** Depois do fix de 28/07 (`c128e38`), **nenhum código chama** essa função — mas ela segue
exportada em `src/lib/sheets.ts`.

**O que arrisca.** É exatamente a função que causou o bug das reuniões: ela **não distingue "aba
ausente" de "primeira aba do documento"**, então devolve dado errado sem erro. Deixá-la disponível é
convite para alguém usá-la de novo sem saber da armadilha.

**Como sanar.** Remover, ou marcar `@deprecated` com aviso explícito apontando para `fetchTabStrict`.
Preferência: **remover** — quem precisar de leitura tolerante usa `fetchTabStrict` com assinatura.

**Onde.** `src/lib/sheets.ts:101`.

---

### D-04 · `main` está 28 commits atrás da produção

**O que é.** O deploy de 28/07 saiu **da branch** `feat/auth-individual` via `vercel --prod`, não de
um merge. O que roda em produção **não está no `main`**.

**O que arrisca.** O `main` deixou de representar produção. Qualquer pessoa (ou automação) que assuma
"main = o que está no ar" se engana. Um deploy futuro a partir do `main` faria **rollback silencioso**
de tudo do lote de julho.

**Como sanar.** Merge de `feat/auth-individual` em `main` (ou redefinir a branch de produção na
Vercel, conscientemente).

---

### D-05 · Metas por canal estão zeradas

**O que é.** `channel_targets` tem os 3 canais criados com `valor_mensal = 0`
(`direto=0 · parceiro=0 · securisoft=0`).

**O que arrisca.** A funcionalidade de meta por canal — entregue e no ar — **não exibe nada**: sem
meta > 0, a barra de atingimento e o consolidado ficam ocultos por design. Ou seja, a feature parece
não existir para quem abre a tela.

**Como sanar.** Marcos preenche pelo **lápis** na seção "Receita por Canal" da página inicial,
logado como admin. É configuração, não código.

---

### D-06 · Senha compartilhada anula a auditoria individual

**O que é.** Foi decidido usar `Defenz123` como senha para todos os usuários.

**O que arrisca.** O `access_log` registra quem entrou e de qual IP — mas se todos têm a mesma senha,
**qualquer pessoa pode entrar como qualquer outra**, e o registro deixa de provar autoria. Some-se a
isso que a senha é fraca e não há troca self-service (só admin reseta).

**Como sanar.** Tratar `Defenz123` como **senha inicial** e trocar por pessoa. O ideal é incluir
"troca obrigatória no primeiro acesso" na spec do `owner` (D-01) — as duas mexem na mesma tela.

---

### D-07 · `DASHBOARD_PASSWORD` ainda existe na Vercel

**O que é.** A variável da senha única continua nas env vars de produção (criada há 49 dias). **O
código não a lê mais** desde a migração para login individual.

**O que arrisca.** Baixo risco funcional — é configuração morta. Mas induz a erro: alguém pode
concluir que a senha compartilhada ainda vale, ou reintroduzir código que a leia.

**Como sanar.** `vercel env rm DASHBOARD_PASSWORD production`. Não foi feito porque remover variável
de produção é irreversível e não estava no pedido.

---

## 🔵 Baixa

### D-08 · Três campos declarados em `RawDeal` que a planilha não exporta

**O que é.** `data_renovacao`, `recurring` e `owner` existem no tipo `RawDeal` mas **não são
colunas da aba `deals`**. Compilam e leem `undefined`.

**O que arrisca.** Métricas que dependem deles (`computeComissaoOwnerCanal`,
`computeRenovacoesVencidas`) produzem vazio/0 **em silêncio**. Há comentário FOOTGUN no código
alertando — mas o tipo continua mentindo sobre o que existe.

**Como sanar.** Ou exportar os campos no n8n (mesmo procedimento de 3 partes usado para `licencas`
em 28/07), ou remover do tipo. **A migração para o Neon resolve por construção** — schema explícito.

**Onde.** `src/lib/types.ts:76-78`.

---

### D-09 · Reuniões dependem de proxy porque a integração de calendário está fora

**O que é.** A aba `reunioes` não existe; o token do Microsoft Calendar expirou (P4). As reuniões são
derivadas de marcações `[REUNIAO]` no campo de resultados dos negócios.

**O que arrisca.** A métrica depende de o vendedor escrever a marcação à mão — subcontagem provável.
Já está corretamente tratado no código (`fetchTabStrict` devolve null e cai no proxy), então **não é
bug**; é limitação de fonte.

**Como sanar.** Reautorizar a integração de calendário no n8n.

---

### D-10 · MCP do Neon e da Vercel sem autorização concluída

**O que é.** Ambos instalados no escopo de conta, mas em "needs authentication" — o OAuth nunca foi
finalizado.

**O que arrisca.** Nada em produção. Só limita a operação assistida: o banco só é alcançável a partir
deste projeto (via `.env.local`), não de outros.

**Como sanar.** Concluir o OAuth em sessão interativa (`/mcp` → selecionar → Authenticate), ou usar a
variante com chave de API. Detalhe: a chave gerada em 28/07 foi **exposta em texto puro** no chat e
**deve ser revogada** antes de qualquer uso.

---

## Sanadas

| Data | Dívida | Commit |
|---|---|---|
| 28/07 | Relatório mensal contava ~11,5k ligações como reuniões (leitura não-estrita da aba) | `c128e38` |
| 28/07 | Coleta de negócios sem paginação — base instalada incompleta (3.346 de 5.919 licenças). Era a dívida **P13**. | n8n (doc §7.3) |
| 28/07 | Instabilidade do provedor de IA derrubava a execução inteira e custava a gravação do turno | n8n (doc §7.1) |
| 28/07 | `licencas` não exportado para a aba `deals` | n8n (doc §7.2) |
