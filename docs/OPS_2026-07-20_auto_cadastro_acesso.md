# Fluxo de acesso — auto-cadastro com aprovação do gestor

**Feature:** PRD #127 (issues #128–#132)
**Status:** implementado (#128–#131); validação E2E e checks operacionais abaixo (#132)

---

## Como funciona o acesso agora

O gestor deixou de inventar e transmitir senhas. Duas vias de acesso coexistem:

1. **Auto-cadastro (novo):** a pessoa acessa `/cadastro`, define a própria
   senha e envia a solicitação. A conta é criada com `app_metadata.role =
   "pendente"` — autentica, mas fica **confinada** a `/aguardando-aprovacao`
   (toda página redireciona para lá; toda API responde 403, exceto o signout).
   O gestor vê o pedido na seção **"Solicitações pendentes"** da tela de
   usuários e **aprova escolhendo a role** (default `comum`) ou **rejeita**
   (remove a conta; o e-mail fica livre para novo cadastro).
2. **Criação direta pelo gestor (mantida):** continua igual — via rápida com
   e-mail, senha e role definidos pelo gestor.

### Ponto de segurança central

O fallback de role deixou de ser `?? "gestor"` (que tornava admin qualquer
conta sem role) e passou a ser `?? "pendente"` (bloqueio). Vale no proxy
(`src/lib/supabase/middleware.ts`), no `validateApiAuth`
(`src/lib/utils/api-auth.ts`) e nos mapeamentos de `GET/PATCH /api/admin/users`.

### Sessão do aprovado

A role vive no JWT; a sessão ativa pode levar até o refresh do token (~1h ou
novo login) para refletir a aprovação. A página de espera orienta a pessoa a
**sair e entrar novamente**.

---

## Checklist de validação E2E (#132) — requer ambiente com Supabase

> As jornadas abaixo têm cobertura de teste de integração em cada seam
> (`api-auth`, `middleware`, `signup`, `admin/users`, `SignupForm`,
> `UserManagement`). Esta lista é a validação manual de ponta a ponta contra
> um Supabase real, que os testes não substituem.

- [ ] **Fluxo feliz:** cadastrar em `/cadastro` → logar → cair em
  `/aguardando-aprovacao` → gestor aprova como `analista` → após novo
  login/refresh, a pessoa navega conforme `analista`.
- [ ] **Rejeição:** rejeitar → login falha com a mensagem padrão → novo
  cadastro com o mesmo e-mail é aceito.
- [ ] **Bloqueio do pendente:** com sessão pendente, `/api/admin/users` e
  `/api/base-de-dados/*` respondem 403; todas as páginas redirecionam.
- [ ] **Anti-abuso:** 20 pendentes → 429 no cadastro; rajada do mesmo IP é
  limitada (melhor esforço em serverless — ver riscos aceitos).
- [ ] **Regressão:** criação direta pelo gestor, troca de role, deleção,
  restrições de `comum`, login e signout idênticos ao comportamento anterior.

## Checklist operacional (Supabase / ambiente) — ação manual

- [ ] **"Enable sign ups" DESABILITADO** no projeto Supabase. Todo o fluxo
  passa pela nossa API com service role; signup público habilitado pularia o
  estado `pendente`.
- [ ] **Nenhum usuário ativo sem `app_metadata.role`** antes do deploy.
  **Bloqueante — não é "melhor prevenir", é pré-requisito.** Com o novo
  fallback `pendente`, toda conta legada sem role cai em "aguardando
  aprovação" no primeiro login, **inclusive os gestores**. E como
  `/api/admin/users` exige role `gestor`, ninguém sobra para aprovar
  ninguém: o lockout é total e **não tem recuperação pela UI**. Confirmado
  em 2026-07-21 (conta legada do owner caiu na tela de espera em ambiente
  local).

  Rode o backfill **antes** de subir esta branch, e confirme que o dry-run
  final acusa zero contas sem role:

  ```
  node scripts/backfill-user-roles.mjs            # dry-run: lista as contas legadas
  node scripts/backfill-user-roles.mjs --apply    # grava a role explícita
  node scripts/backfill-user-roles.mjs            # deve reportar "contas sem role: 0"
  ```

  O script roda fora do app, com service role, justamente para funcionar com
  o acesso web já bloqueado. Ele é idempotente e só toca em contas sem role —
  cadastros novos gravam `pendente` explicitamente e nunca são afetados.

  > O antigo `POST /api/admin/first-time-setup` foi **removido**. Ele
  > promovia a `gestor` toda conta sem role e era gated por
  > `requireRole(["gestor"])` — inacessível exatamente no cenário em que
  > seria necessário, e um caminho de escalonamento de privilégio sob o novo
  > fallback. O backfill acima o substitui.

## Riscos aceitos (registrar, não resolver — PRD §8)

- **Rate limit em memória** é melhor esforço em serverless (não compartilhado
  entre instâncias/cold starts). O **teto de 20 pendentes** é a barreira dura.
- **Sessão do aprovado** pode levar até o refresh do token para refletir a
  nova role; a página de espera orienta sair e entrar de novo.
- **Enumeração de e-mails:** o erro de duplicado confirma existência do
  e-mail; mitigado pela mensagem única (não distingue ativo × pendente) e pelo
  rate limit. Aceito para ferramenta interna.
