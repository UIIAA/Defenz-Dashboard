-- feature-super-admin — terceiro papel, superset de admin.
--
-- MOTIVO 1 (imediato): telas ainda não liberadas (Executivo, Operacional) ficam visíveis
-- só pra quem é super_admin, enquanto os números não são conferidos.
--
-- MOTIVO 2 (dívida D-01): hoje os papéis são planos — QUALQUER admin pode desativar a conta
-- de outro admin ou trocar a senha dele, inclusive a do dono. A mitigação era frágil ("só
-- existe um admin"). Com super_admin, a regra passa a ser: só super_admin mexe em super_admin.
--
-- ORDEM DE APLICAÇÃO IMPORTA. O código em src/lib/auth.ts rejeita sessão cujo papel não
-- esteja na lista conhecida (`verifySession`). Se esta migration rodar ANTES do deploy do
-- código que conhece 'super_admin', o usuário promovido NÃO CONSEGUE LOGAR.
--   1º deploy do código  →  2º esta migration.
--
-- Idempotente: pode reaplicar.

-- 1) o papel passa a ser aceito pelo banco
alter table users drop constraint if exists users_role_check;
alter table users add constraint users_role_check
  check (role in ('super_admin','admin','member'));

-- 2) promoção do dono. É mudança de DADO, não de schema — está aqui para o ambiente
--    ficar reproduzível, e é guardada para não recriar usuário nem sobrescrever outro papel.
update users
   set role = 'super_admin'
 where email = 'marcos@defenz.com.br'
   and role <> 'super_admin';
