# Spec — Autenticação individual no dashboard (Neon)

> **Origem:** pedido do Marcos (2026-07-20). Hoje o dashboard usa **uma senha única compartilhada**; queremos **login por pessoa**.
> **Status:** ✅ **IMPLEMENTADO no localhost (2026-07-20)** — Fase 1 + Fase 2, contra Neon real. **Não commitado** (Marcos vai testar antes). Ver §16.
> **Base:** auth atual = `DASHBOARD_PASSWORD` único + cookie HMAC sem identidade (`src/lib/auth.ts`, `src/middleware.ts`, `src/app/login/*`). Esta feature **introduz o Neon** no projeto, **só para auth**.
> **Decisão de escopo maior (travada 2026-07-20):** o banco entra como **beachhead** da auth. Migrar os *dados do dashboard* (métricas/deals) pro banco ("banco no centro") é **outra spec, no futuro** — ver §15. Aqui o pipeline Sheets/n8n **não é tocado**.

---

## 1. Objetivo e escopo

**Objetivos (o que o Marcos pediu):**
1. **Saber quem acessa** — cada pessoa com login próprio (e-mail + senha), no lugar da senha única.
2. **Log de auditoria** — histórico de acessos (quem entrou/tentou, quando).
3. **Base para papéis** — coluna `role` pronta pra permissões no futuro (sem implementar permissão-por-tela agora).

**Dentro do escopo:** login por e-mail+senha, sessão que carrega a identidade, tabela de usuários, log de auditoria, tela `/admin` (gestão + ver acessos), papel `admin`/`member`, migração da senha única.

**Fora do escopo (trava explícita):**
- Dados do dashboard (métricas, deals, ligações, resumo diário) **continuam no Sheets/n8n**. Zero mudança no pipeline.
- Permissão por-tela (todos os papéis veem os mesmos dashboards por enquanto).
- Auto-cadastro, auto-serviço de reset de senha por e-mail, SSO/Google, 2FA — todos anotados como futuros, nenhum agora (YAGNI).

## 2. Decisões travadas (com o Marcos)

| # | Decisão |
|---|---|
| Store | **Neon (Postgres serverless)**, integração nativa Vercel (`DATABASE_URL`). **Só auth.** |
| Credencial | **E-mail + senha**, senha com **hash scrypt** (`node:crypto`, sem dependência nova). |
| Sessão | Continua **cookie HMAC** (o que já existe), agora carregando `{ sub, email, name, role }`. **Middleware não consulta o banco.** |
| Banco tocado | **Só no login** (conferir senha) e em **auditoria/admin**. Cada request comum valida só a assinatura do cookie. |
| Papéis | `admin` \| `member`. Hoje só decide acesso ao `/admin`. |
| Senha única | **Removida** depois da migração. |

## 3. Arquitetura

```
Login (server action, Node)  ──►  Neon: busca user, confere senha, grava last_login + access_log
        │
        └─►  cria cookie HMAC { sub, email, name, role, iat, exp }  (assinado com AUTH_SECRET)

Request comum  ──►  middleware valida ASSINATURA do cookie (Web Crypto, sem DB)  ──►  segue
Request /admin ──►  idem + exige role === 'admin'  (lido do payload, sem DB)

Neon é tocado só em: login, logout (grava audit), e nas telas/ações de /admin.
```

**Propriedade boa de resiliência:** se o Neon cair, quem já está logado continua navegando (o middleware não depende do banco); só *novos logins* falham.

**Trade-off consciente (revogação):** como a sessão é um cookie assinado de 7 dias sem consultar o banco, **desativar** um usuário bloqueia **novos** logins na hora, mas a sessão ativa dele expira naturalmente (até 7 dias). Kill imediato de **todas** as sessões = rotacionar `AUTH_SECRET` (break-glass). Revogação instantânea individual exigiria uma tabela de sessões consultada a cada request — **fora do escopo** (ver §14, item aberto).

## 4. Modelo de dados (Neon)

```sql
-- 0001_auth.sql
create table users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,        -- sempre gravado/consultado em lower-case
  name          text not null,
  password_hash text not null,               -- formato: scrypt$<N>$<r>$<p>$<saltHex>$<hashHex>
  role          text not null default 'member' check (role in ('admin','member')),
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  last_login_at  timestamptz
);

create table access_log (
  id          bigint generated always as identity primary key,
  user_id     uuid references users(id) on delete set null,
  email       text not null,                 -- e-mail TENTADO (gravado mesmo em falha)
  event       text not null check (event in ('login_ok','login_fail','logout')),
  ip          text,
  user_agent  text,
  created_at  timestamptz not null default now()
);
create index access_log_created_idx on access_log (created_at desc);
create index access_log_email_idx   on access_log (email);
```

`access_log` grava **falhas também** (com o e-mail tentado + IP) — é o que entrega o "quem tentou entrar".

## 5. Fluxo de login (delta mínimo sobre o atual)

1. `/login` ganha campo **e-mail** (`LoginForm.tsx` hoje só tem senha).
2. `loginAction` (server action, roda em Node):
   1. Valida inputs (e-mail + senha não vazios).
   2. **Throttle** (§7): se e-mail/IP excedeu tentativas recentes → erro genérico, sem consultar o banco.
   3. Busca `users` por `lower(email)` com `active = true`.
   4. **Se não achar** → faz um `verifyPassword` *dummy* (hash fixo) pra igualar o tempo → não vaza quais e-mails existem (anti-enumeração/timing). Grava `access_log(login_fail)`. Retorna erro genérico.
   5. Confere senha (`verifyPassword`, scrypt, comparação constant-time).
   6. **Sucesso:** `update last_login_at`, grava `access_log(login_ok)`, cria sessão com identidade, seta cookie, `redirect('/')`.
   7. **Falha de senha:** grava `access_log(login_fail)`, retorna `{ error: "E-mail ou senha incorretos." }`.
3. Mensagem de erro **sempre genérica** (nunca "usuário não existe" vs "senha errada").
4. **Logout** (`GET /api/auth/logout`): lê a sessão (pra saber quem), grava `access_log(logout)`, limpa o cookie, redireciona pra `/login`.

## 6. Sessão (estende `src/lib/auth.ts`)

Payload passa de `{ authenticated, iat, exp }` para:

```ts
interface SessionPayload {
  sub: string;              // users.id
  email: string;
  name: string;
  role: 'admin' | 'member';
  iat: number;
  exp: number;
}
```

- `createSession(user)` recebe o usuário e assina o payload (mesma mecânica HMAC-SHA256 hex atual).
- `verifySession` inalterada na mecânica; passa a **exigir `sub`** — cookies antigos (senha única, sem `sub`) viram inválidos → forçam re-login uma vez.
- Novo helper `sessionRole(session)` / gate de papel usado no middleware e nas server actions de `/admin`.

## 7. Segurança

- **Hash:** `scrypt` do `node:crypto` (N=16384, r=8, p=1, keylen=64, salt aleatório de 16 bytes). Sem dependência nova. Formato serializado `scrypt$N$r$p$saltHex$hashHex`.
- **Comparação** de hash constant-time (`crypto.timingSafeEqual`).
- **Anti-enumeração:** dummy-hash no caminho "user não existe" (§5.4).
- **Throttle de login:** in-memory (mesmo padrão do rate-limiter que já existe em `/api/dashboard`), ex.: **5 falhas / 15 min por (e-mail+IP)** → bloqueia com erro genérico. (Nota: in-memory reseta por instância serverless; suficiente pra brute-force de baixo volume. Opção robusta = contador no Neon — anotado, não default.)
- **SQL** sempre parametrizado (tagged template do `@neondatabase/serverless` — seguro contra injeção).
- **Cookie** inalterado: `httpOnly`, `secure` (prod), `sameSite: lax`, `path: /`, `maxAge` 7 dias.
- **Nunca** logar senha. `access_log` guarda e-mail + evento, jamais a senha.
- `DATABASE_URL` e `AUTH_SECRET` só em env (nunca commit).

## 8. Gestão de usuários + auditoria → `/admin` (só `admin`)

Como o Marcos quer **ver** a auditoria, a casa natural é uma tela `/admin` mínima, gated por `role === 'admin'` (no middleware + re-checado nas server actions):

- **Usuários:** listar · criar · desativar/reativar · resetar senha.
- **Acessos:** últimas N linhas do `access_log` (quem entrou/tentou, quando, IP).

**Bootstrap / break-glass — CLI** (`scripts/users.ts`, rodável local com `DATABASE_URL`): cria o **primeiro admin** (não dá pra usar `/admin` sem admin), reseta senha de quem se trancou, lista/desativa. Comandos: `user:add`, `user:reset`, `user:disable`, `user:list`.

> Alternativa mais enxuta (se quiser cortar a Fase 2): **só o CLI** pra gerir usuários e ver a auditoria direto no Neon. Recomendação = ter o `/admin` (um log que você não consegue olhar não serve). Decisão final no §14.

## 9. Papéis

`role` = `admin` | `member`. Hoje a **única** diferença: `admin` acessa `/admin`; `member` não (redirect pra `/`). Todos veem os mesmos dashboards. Restrição por-tela no futuro vira trivial (coluna + gate já existem).

## 10. Migração / rollout

1. Provisionar Neon via integração Vercel → `DATABASE_URL` nas envs (dev + prod).
2. Aplicar `0001_auth.sql` (via `npm run db:migrate` ou console do Neon).
3. **Seed** via CLI: criar o admin (Marcos) + time (Gustavo, Leonardo, Cris, …) com senha inicial; compartilhar por canal seguro.
4. Deploy do código (login e-mail+senha; middleware exige `sub`; `/admin`).
5. **Remover** `DASHBOARD_PASSWORD` das envs.
6. Time re-loga uma vez com a credencial individual.

**Reset de senha:** admin reseta (via `/admin` ou CLI) e informa a pessoa. Sem auto-serviço por e-mail (YAGNI pra ~5 pessoas; futuro).

## 11. Módulos e arquivos (isolados, testáveis)

| Arquivo | Papel |
|---|---|
| `src/lib/db.ts` (novo) | Cliente Neon (`neon(process.env.DATABASE_URL)`), exporta `sql`. **Fundação reusável** da migração futura (§12). |
| `src/lib/password.ts` (novo) | `hashPassword` / `verifyPassword` (scrypt) — **puro, 100% testável**. |
| `src/lib/users.ts` (novo) | Repo: `findActiveUserByEmail`, `recordLogin`, `logAccess`, `listUsers`, `listRecentAccess`, `createUser`, `setActive`, `setPassword`. Thin sobre `db.ts`. |
| `src/lib/auth.ts` (edita) | `SessionPayload` com identidade; `createSession(user)`; `verifySession` exige `sub`; gate de papel. |
| `src/app/login/actions.ts` (edita) | `loginAction` reescrito (e-mail+senha, throttle, repo, auditoria). |
| `src/app/login/_components/LoginForm.tsx` (edita) | Campo e-mail. |
| `src/middleware.ts` (edita) | Gate `/admin` (exige `role==='admin'`, lido do cookie — sem DB). |
| `src/app/api/auth/logout/route.ts` (edita) | Grava `access_log(logout)` antes de limpar. |
| `src/app/admin/*` (novo) | Telas `/admin`: usuários + acessos (Fase 2). |
| `scripts/users.ts` (novo) | CLI seed/admin/break-glass. |
| `db/migrations/0001_auth.sql` (novo) | Schema. |

**Sem ORM:** SQL parametrizado via driver Neon. (Drizzle fica como opção se quiser schema-as-code — anotado, não default.)

**Env vars:** `+DATABASE_URL` (Neon), `AUTH_SECRET` (mantém), `−DASHBOARD_PASSWORD` (remove pós-migração).

## 12. Fases (cada uma deixa o app rodável)

- **Fase 1 — núcleo:** Neon + schema + `db.ts`/`password.ts`/`users.ts` + login e-mail/senha + auditoria + sessão-com-identidade + CLI de seed. **Já substitui a senha compartilhada.**
- **Fase 2 — admin:** tela `/admin` (usuários + auditoria) + gate de papel no middleware.

## 13. Testes

- `password.test.ts`: round-trip scrypt; senha errada falha; string malformada → false; hashes diferentes pra mesma senha (salt).
- `auth.test.ts`: token carrega `sub/role`; expirado rejeitado; assinatura adulterada rejeitada; cookie antigo sem `sub` rejeitado.
- gate de papel: `admin` passa em `/admin`, `member` é barrado.
- throttle: N falhas bloqueiam; janela expira.
- `loginAction` (mockando `users.ts`): sucesso; senha errada (grava `login_fail`); e-mail inexistente (dummy-hash, `login_fail`); usuário inativo.

## 14. Itens abertos (decidir na aprovação/revisão)

1. **`/admin` telinha vs CLI-only** — recomendo a telinha (Fase 2). Cortar pra só-CLI encolhe o MVP.
2. **Revogação instantânea** — recomendo **não** (stateless + break-glass via `AUTH_SECRET`). Se quiser kill individual imediato, adiciono tabela de sessões (custo: DB por request).
3. **Tempo de sessão** — manter 7 dias? (menor = menos lag de revogação, mas re-login mais frequente). Recomendo manter 7d.
4. **Reset de senha** — admin-only agora (recomendado) vs auto-serviço por e-mail (futuro).

## 15. Nota — fundação pro futuro "banco no centro"

O `src/lib/db.ts` e a conexão Neon desta feature são **de propósito** a base da migração de dados futura (mover `deals`/`resumo_diario`/etc. do Sheets pro Postgres). A camada de cálculo (`computeMetas`, `computeFarol`, `parseResumoRow`, `computeMetrics`) já é desacoplada da busca — recebe arrays de linhas — então aquela migração será **trocar a função-fonte por um `SELECT`**, não reescrever a lógica. Isso é **outra spec**; aqui só deixamos a fundação pronta.

## 16. Implementação (localhost — 2026-07-20)

Fase 1 + Fase 2 implementadas e **verificadas end-to-end** contra o **Neon real** (projeto do Marcos, `neondb`), rodando no `localhost:3005`. **Não commitado.**

**Refinamentos sobre a spec (decididos na implementação):**
- **Driver:** `@neondatabase/serverless` (como a spec previu). Instalado.
- **CLI:** `scripts/users.mjs` (JS puro, carrega `.env.local` via `process.loadEnvFile`) em vez de `.ts` — evita dep de runner (tsx). Comandos: `migrate | add | list | reset | disable | enable`. O `verifyPassword` lê N/r/p do próprio hash, então não há acoplamento de parâmetros entre CLI e app.
- **Env:** `DATABASE_URL` (pooled, app) + `DATABASE_URL_UNPOOLED` (direto, migrations) no `.env.local` (gitignored). `DASHBOARD_PASSWORD` continua na env mas **deixou de ser lido** (login agora é e-mail/senha) — remover no deploy.

**Verificado ao vivo:** login admin → dashboard; `/admin` (usuários + auditoria + último acesso); login member → dashboard; member **barrado** em `/admin` (redirect); senha errada → erro genérico; `access_log` gravou `login_ok`/`logout`/`login_fail` com IP. `84` testes verdes, `npm run build` ok.

**Usuários de teste seeded (localhost):** `marcos@defenz.com.br` (admin) e `gustavo@defenz.com.br` (member).

**Pra ir pra produção (quando o Marcos aprovar):** setar `DATABASE_URL` nas envs da Vercel (integração Neon), rodar `node scripts/users.mjs migrate`, seed dos usuários reais, **remover** `DASHBOARD_PASSWORD`, deploy. Os 4 itens do §14 (admin telinha ✔ já feita, revogação, tempo de sessão, reset) seguem como escolhas do Marcos.
