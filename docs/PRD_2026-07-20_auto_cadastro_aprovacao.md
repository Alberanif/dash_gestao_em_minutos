# PRD — Auto-cadastro de usuários com aprovação do gestor

**Date:** 2026-07-20
**Status:** Approved (decisões validadas em entrevista com o owner)
**Owner:** Alberani

## 1. Contexto e problema

Hoje **só um `gestor` cria contas** no sistema. O fluxo atual:

- O gestor abre a tela de usuários (`UserManagement`, montada em `/ajustes/configuracoes`) e preenche **e-mail, senha e role** do novo usuário.
- `POST /api/admin/users` (restrito a `gestor` via `requireRole`) cria o usuário no Supabase Auth com o **service role client** (`auth.admin.createUser`), já com `email_confirm: true` e `app_metadata: { role }`.
- Não existe tela de cadastro: o formulário de login (`src/components/auth/login-form.tsx`) só faz `signInWithPassword`, e a própria UI diz "Use as credenciais fornecidas pelo seu gestor". O signup público do projeto Supabase permanece desabilitado.
- As roles (`gestor` | `analista` | `comum`, em `src/types/auth.ts`) vivem em `app_metadata.role` (só editável server-side) e são aplicadas pelo middleware (`src/lib/supabase/middleware.ts`) e por `requireRole`/`validateApiAuth` (`src/lib/utils/api-auth.ts`).

**Problemas:** o gestor é gargalo (cria conta, inventa senha, transmite a senha por um canal qualquer) e o novo usuário recebe uma senha que não escolheu — prática ruim de segurança (senha conhecida por terceiro, transmitida em texto).

**Objetivo:** o próprio usuário cria sua conta e define sua senha, mas **só ganha acesso depois que um `gestor` aprovar a solicitação**. O gestor deixa de gerenciar senhas e passa a apenas aprovar/rejeitar e atribuir a role.

**Falha pré-existente que esta feature obriga a corrigir:** hoje o fallback de role é `?? "gestor"` (middleware linha 51, `api-auth.ts` linha 23, e nos mapeamentos das rotas admin) — um usuário **sem role vira admin por padrão**. Com auto-cadastro isso seria catastrófico; o fallback passa a ser o estado mais restritivo (`pendente`).

## 2. Escopo

### Incluído (v1)

- **Tela de cadastro** pública (rota nova, ex.: `/cadastro`), linkada a partir do login: nome completo, e-mail, senha + confirmação de senha.
- **API pública de signup** (`POST /api/auth/signup`) que cria o usuário via service role com `app_metadata: { role: "pendente" }` e `user_metadata: { name }`, `email_confirm: true` — sem habilitar o signup público do Supabase e sem confirmação por e-mail.
- **Estado `pendente`**: usuário autentica normalmente, mas o middleware o confina à página **`/aguardando-aprovacao`** e bloqueia todas as APIs (403).
- **Fila de aprovação** na tela de usuários existente: seção "Solicitações pendentes" com badge/contador; aprovar = escolher role (`gestor`/`analista`/`comum`, default `comum`); rejeitar = deletar o usuário do Auth.
- **Anti-abuso**: rate limit por IP no endpoint de signup + teto de solicitações pendentes (20).
- **Correção do fallback de role** `?? "gestor"` → `pendente` em todos os pontos.
- Exibição do **nome** do usuário (quando existir) na listagem de usuários do gestor.

### Fora de escopo (v1)

| Item | Motivo |
|---|---|
| Confirmação de e-mail no cadastro | A aprovação humana do gestor já valida a legitimidade; evita configurar SMTP/templates e manter o signup do Supabase desabilitado |
| Notificação por e-mail (ao gestor ou ao aprovado) | Projeto não tem infra de e-mail; time pequeno e interno — a seção com badge na UI basta |
| Recuperação de senha ("esqueci minha senha") | Fluxo independente, também exigiria e-mail; continua no modelo atual (gestor redefine) |
| Campo "motivo/área" no cadastro | Excesso para painel interno; nome + e-mail identificam o solicitante |
| Allowlist de domínios de e-mail | Bloquearia colaboradores com Gmail/outros domínios legítimos |
| Remoção do fluxo atual de criação pelo gestor | Continua existindo como via rápida — as duas formas coexistem |

## 3. Experiência do usuário

### 3.1 Solicitante

1. Na tela de login, abaixo do card, um link **"Não tem conta? Solicitar acesso"** leva a `/cadastro` (mesma identidade visual do login: painel azul IGT + card).
2. Formulário: **nome completo**, **e-mail**, **senha**, **confirmar senha**. Validações inline (e-mail válido, senha mínima de 8 caracteres, senhas iguais).
3. Ao enviar com sucesso: mensagem "Solicitação enviada! Você poderá entrar assim que um administrador aprovar seu acesso." com link de volta ao login.
4. Se logar enquanto pendente: qualquer rota redireciona para **`/aguardando-aprovacao`** — página simples (identidade do login) com "Sua conta aguarda aprovação do administrador" e botão **Sair** (signout existente).
5. Depois de aprovado: o próximo login (ou refresh da sessão) entra normalmente com a role atribuída.
6. Se rejeitado: a conta é removida; o login volta a falhar com a mensagem padrão de credenciais. A pessoa pode se cadastrar de novo (e-mail fica livre).

### 3.2 Gestor

1. Na tela de usuários (`/ajustes/configuracoes`), acima da lista atual, a seção **"Solicitações pendentes"** aparece **apenas quando há pendências**, com contador (ex.: "Solicitações pendentes · 3").
2. Cada solicitação mostra **nome, e-mail e data do pedido**, com duas ações:
   - **Aprovar** — abre seletor de role (`comum` pré-selecionado) e confirma.
   - **Rejeitar** — confirmação simples ("Rejeitar e remover a solicitação de fulano@…?") e deleta.
3. Aprovado some da seção e aparece na lista normal de usuários; rejeitado some do sistema.

## 4. Regras de negócio

- **`pendente` não é uma role de acesso** — é um estado de conta. Nunca aparece nos seletores de role (criação pelo gestor, troca de role, aprovação); `validRoles` das APIs admin continua `["gestor", "analista", "comum"]`.
- **Aprovar** = trocar `app_metadata.role` de `pendente` para a role escolhida (reusa `PATCH /api/admin/users/[id]`). **Rejeitar** = `auth.admin.deleteUser` (reusa `DELETE /api/admin/users`).
- **Fallback seguro**: em qualquer ponto onde a role é lida e está ausente/desconhecida, o comportamento é o de `pendente` (bloqueio), nunca `gestor`. ~~Usuários legados sem role já foram migrados pelo `first-time-setup`.~~ **Falso** — verificado em 2026-07-21: havia contas legadas sem role, e a conta do owner caiu na tela de espera. A migração passou a ser feita por `scripts/backfill-user-roles.mjs`, pré-requisito bloqueante de deploy (ver OPS).
- **E-mail duplicado** no signup: erro amigável "Este e-mail já possui conta ou solicitação em andamento" (sem distinguir os casos).
- **Teto de pendentes**: com 20 solicitações pendentes, o signup responde 429 "Limite de solicitações atingido, tente mais tarde".
- **Rate limit**: máx. ~5 tentativas de signup por IP em janela de 15 min (melhor esforço em ambiente serverless; ver §8).
- O usuário pendente **pode autenticar** (sessão Supabase válida) — o confinamento é responsabilidade do middleware e das APIs, e é isso que torna a aprovação instantânea (sem reset de senha ou reenvio de credencial).

## 5. Requisitos funcionais

- **RF-1** — Link "Solicitar acesso" no login leva a `/cadastro`; o formulário cria a conta com nome, e-mail e senha definidos pelo solicitante.
- **RF-2** — `POST /api/auth/signup` (público) cria o usuário com `role: "pendente"`, validando nome, formato de e-mail, senha ≥ 8 e confirmação; aplica rate limit por IP e teto de 20 pendentes.
- **RF-3** — Usuário `pendente` autenticado: toda rota de página redireciona para `/aguardando-aprovacao` (única acessível, além do signout); toda rota `/api/*` responde 403 — ambos no middleware, antes de qualquer handler.
- **RF-4** — `/aguardando-aprovacao` exibe o estado da conta e botão Sair; usuário não-pendente que acessar a rota é redirecionado para `/`.
- **RF-5** — Seção "Solicitações pendentes" na tela de usuários, visível só para `gestor`, com contador, nome, e-mail e data de cada solicitação.
- **RF-6** — Aprovar exige escolher a role (default `comum`) e efetiva via troca de `app_metadata.role`; o usuário passa a acessar conforme a role sem qualquer outra ação.
- **RF-7** — Rejeitar remove o usuário do Supabase Auth após confirmação; o e-mail fica livre para novo cadastro.
- **RF-8** — `GET /api/admin/users` passa a retornar `name` (de `user_metadata`) e a role real inclusive `pendente`, permitindo à UI separar fila e lista.
- **RF-9** — Nenhum ponto do sistema atribui `gestor` como fallback de role ausente; o fallback é `pendente` (bloqueio).
- **RF-10** — Fluxo atual de criação direta pelo gestor (com senha) permanece funcionando sem mudanças.

## 6. Requisitos técnicos

### 6.1 Tipos e fallback

- `src/types/auth.ts`: `UserRole` mantém `'gestor' | 'analista' | 'comum'`; novo tipo `AccountRole = UserRole | 'pendente'` para os pontos que leem o estado bruto.
- Trocar `?? "gestor"` por `?? "pendente"` em: `src/lib/supabase/middleware.ts:51`, `src/lib/utils/api-auth.ts:23` e nos mapeamentos de `GET /api/admin/users` e `PATCH /api/admin/users/[id]`. `validateApiAuth` com role `pendente` retorna 403 direto (nenhuma API de negócio é liberada).

### 6.2 API de signup — `POST /api/auth/signup` (rota nova, pública)

1. Body `{ name, email, password, passwordConfirm }`; validação server-side (nome não vazio, e-mail válido, senha ≥ 8, confirmação igual).
2. Rate limit por IP (janela 15 min, ~5 tentativas) — implementação leve em memória, sem dependência nova (ver limitação em §8).
3. Conta usuários com `app_metadata.role === "pendente"` via `auth.admin.listUsers`; ≥ 20 → 429.
4. `auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { role: "pendente" }, user_metadata: { name } })` com o service client existente (`createSupabaseServiceClient`).
5. E-mail já existente → 409 com mensagem única (sem vazar se é conta ativa ou pendente).
6. O middleware precisa **liberar** `/cadastro` e `/api/auth/signup` para não-autenticados (hoje tudo fora de `/login` redireciona).

### 6.3 Middleware — estado pendente

Em `updateSession`, após resolver o usuário: se `role === "pendente"`, permitir apenas `/aguardando-aprovacao` e `/api/auth/signout`; demais páginas → redirect para `/aguardando-aprovacao`; demais `/api/*` → 403. As regras existentes de `comum` permanecem intactas.

### 6.4 Frontend

- `/cadastro` (`src/app/cadastro/page.tsx` + componente em `src/components/auth/`): mesma anatomia visual do `LoginForm` (painel azul IGT, card, inputs com ícones), estados de loading/erro/sucesso.
- `/aguardando-aprovacao` (`src/app/aguardando-aprovacao/page.tsx`): página estática com botão Sair (POST no signout existente).
- Link "Solicitar acesso" no `LoginForm`, substituindo/complementando o texto "Use as credenciais fornecidas pelo seu gestor".
- `UserManagement`: seção de pendentes (badge, nome, e-mail, data, ações Aprovar com seletor de role e Rejeitar com confirmação), alimentada pelo mesmo `GET /api/admin/users` (filtrando `role === "pendente"` no cliente).
- Antes de codificar, ler os guias em `node_modules/next/dist/docs/` (convenção do projeto — esta versão do Next.js tem breaking changes).

### 6.5 Sem migration

Nenhuma tabela nova: o estado vive em `app_metadata.role` no `auth.users`, como todo o modelo de roles atual.

## 7. Critérios de aceite

1. Visitante cria conta em `/cadastro` com nome, e-mail e senha próprios; recebe a mensagem de solicitação enviada.
2. O usuário criado autentica, mas qualquer rota o leva a `/aguardando-aprovacao`; chamadas diretas a APIs (ex.: `/api/admin/users`, `/api/base-de-dados/*`) respondem 403.
3. O gestor vê a solicitação (nome, e-mail, data) na seção de pendentes com contador correto; usuários ativos não aparecem na fila.
4. Aprovar como `analista`: no próximo acesso o usuário navega conforme as permissões de `analista`, sem redefinir senha ou refazer login obrigatório além do refresh de sessão.
5. Rejeitar: o usuário some da fila, o login com aquelas credenciais falha com a mensagem padrão e um novo cadastro com o mesmo e-mail é aceito.
6. Cadastro com e-mail já existente (ativo ou pendente) retorna a mesma mensagem, sem revelar qual dos casos.
7. Com 20 pendentes, novo cadastro recebe 429; rajada do mesmo IP é limitada.
8. Usuário sem `app_metadata.role` é tratado como pendente (bloqueado) — nenhum caminho resulta em acesso de `gestor` por fallback.
9. Fluxos atuais intocados: criação direta pelo gestor, troca de role, deleção, restrições de `comum` e login existente se comportam de forma idêntica.
10. `pendente` nunca aparece como opção nos seletores de role (criação, troca, aprovação).

## 8. Riscos e pontos de atenção

- **Rate limit em serverless é melhor esforço:** memória não é compartilhada entre instâncias/cold starts. Aceito para v1 (painel interno, URL não divulgada); o teto de 20 pendentes é a barreira dura que limita o dano total. Se abuso real aparecer, evoluir para armazenamento compartilhado.
- **Sessão do pendente aprovado:** a role em `app_metadata` entra no JWT; a sessão ativa do usuário pode levar até o refresh do token (~1h ou novo login) para refletir a aprovação. A página `/aguardando-aprovacao` deve orientar ("aprovado? saia e entre novamente") ou fazer polling leve de sessão.
- **Enumeração de e-mails:** o erro de duplicado confirma que um e-mail tem conta. Mitigado pela mensagem única (não distingue ativo × pendente) e pelo rate limit; risco aceito para ferramenta interna.
- **Fallback `pendente` × usuários legados:** risco **materializado**, não hipotético. Contas legadas sem role caem todas em "aguardando aprovação" no primeiro login — inclusive os gestores, e aí **não há recuperação pela UI**, porque aprovar exige role `gestor`. Rodar `scripts/backfill-user-roles.mjs --apply` antes do deploy é bloqueante; o `first-time-setup`, que se supunha ter feito essa migração, foi removido.
- **Não habilitar signup público no Supabase:** todo o fluxo passa pela nossa API com service role; conferir que "Enable sign ups" segue desabilitado no projeto para não abrir um caminho que pula o estado `pendente`.

## 9. Decisões registradas (entrevista de 2026-07-20)

| # | Decisão | Escolha |
|---|---|---|
| 1 | Modelo de solicitação pendente | Usuário criado no signup com `app_metadata.role = "pendente"`; aprovação = troca de role; sem tabela nova |
| 2 | Aprovação | Gestor escolhe a role ao aprovar (default `comum`) |
| 3 | Rejeição | Deleta o usuário do Supabase Auth; e-mail fica livre para novo cadastro |
| 4 | UX do pendente | Login funciona; middleware confina à página `/aguardando-aprovacao` (com botão Sair) |
| 5 | Notificação ao gestor | Só UI: seção "Solicitações pendentes" com badge na tela de usuários; sem e-mail |
| 6 | Confirmação de e-mail | Não — criação via API própria com `email_confirm: true`; aprovação humana valida; signup público do Supabase segue desabilitado |
| 7 | Campos do cadastro | Nome + e-mail + senha com confirmação |
| 8 | Anti-abuso | Rate limit por IP + teto de 20 solicitações pendentes |
