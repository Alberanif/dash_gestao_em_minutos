# Dash Ultimates — ciclo com múltiplos produtos

**Spec:** `docs/superpowers/specs/2026-07-30-ultimates-multi-produto-design.md`
**Migration:** `056_ultimates_multi_produto.sql`
**Status:** implementado e revisado; **validação manual com dados reais pendente** (checklist abaixo)

---

## O que mudou

Um ciclo deixou de acompanhar **um** produto Hotmart e passou a acompanhar **um
conjunto**, escolhido no momento da criação. Todas as vendas dos produtos do
conjunto formam um único universo: KPIs, roster e curva somam tudo como se fosse
um produto só, e cada comprador conta uma vez — quem renovou em dois produtos
vira uma linha de roster com `total_value` somado, não duas.

O conjunto é definido **na criação e não muda depois**. Todos os produtos
precisam ser da **mesma conta Hotmart**: o primeiro selecionado trava a conta no
modal, e a RPC de criação recusa conjuntos que cruzem contas.

### Mudança estrutural

`dash_gestao_ultimates_cycles.product_id` **deixou de existir**. A fonte de
verdade agora é a tabela de junção `dash_gestao_ultimates_cycle_products`.

Quem for ler ciclos direto do banco precisa saber disso: um `select product_id
from dash_gestao_ultimates_cycles` que funcionava antes agora falha.

---

## Ordem de aplicação — importa

A `056` faz, **nesta ordem, dentro do mesmo arquivo**: cria a junção → faz o
backfill dos ciclos existentes → substitui as 4 RPCs de leitura → dropa a coluna
→ cria a RPC de criação atômica. O `drop column` **precisa** vir depois das RPCs,
senão o `ALTER` falha com as funções ainda referenciando a coluna.

**Antes da `056`, confirmar que as migrations `049`–`055` já foram aplicadas.**
No momento em que esta feature foi escrita havia registro de que a fila estava
atrasada neste ambiente. Aplicar fora de ordem quebra.

**Não suba o código antes da migration, nem a migration antes do código.** As
rotas migradas leem a junção (que não existe antes da `056`); as rotas antigas
leem a coluna (que não existe depois). A janela entre as duas é de indisponibilidade
do módulo.

---

## Checklist de validação manual

Nada disto é coberto por teste automatizado: a suíte roda com o client Supabase
mockado, então **nenhuma das 4 RPCs reescritas é exercitada por teste**. Esta é a
única verificação real da mudança de maior risco.

### 1. Regressão de ciclo mono-produto (o teste que importa)

Num ciclo existente, **antes** de aplicar a `056`, anote: base, renovados, % de
renovação, renovação reembolsada, não renovados, novos compradores, e o total ao
fim da curva nas visões **dia** e **hora**.

Aplique a `056`. Recarregue o mesmo ciclo. Os números têm que ser **idênticos**.

Qualquer valor inflado — tipicamente um múltiplo exato do original — significa
`cross join` sobrevivente numa das RPCs. Era o risco central da feature: as
versões anteriores usavam `cross join cyc` com um CTE de uma linha, e com N
produtos isso multiplicaria cada venda por N, **sem erro e sem exceção**.

### 2. Caminho novo

1. Criar um ciclo com 2 produtos da mesma conta → salva e abre o dashboard com os
   dois nomes no header.
2. Tentar selecionar um produto de outra conta → botão desabilitado, com o motivo
   no `title`.
3. Subir a base de compradores e conferir que um email com compra nos **dois**
   produtos aparece **uma vez** no roster, com `total_value` somado.
4. Abrir "Ofertas excluídas" → ofertas dos dois produtos na lista, cada linha
   mostrando de qual produto é.
5. "Atualizar agora" → sucesso, com `upserted` cobrindo os dois produtos.

---

## Limitações conhecidas

**O orçamento do refresh não escala com o número de produtos.** Os 45s de
`REFRESH_BUDGET_MS` são compartilhados por todos os produtos do ciclo, não por
produto. Um ciclo com muitos produtos e muito histórico estoura e vira 502 com
"A atualização demorou demais e foi interrompida" — o `finally` libera o lock,
então não há lock órfão, mas o gestor pode ficar sem conseguir atualizar aquele
ciclo. Aumentar o orçamento exige rever `LOCK_TTL_MS` (90s) e `maxDuration` (60s)
juntos; ficou deliberadamente fora do escopo.

**A curva conta vendas; o roster conta pessoas.** Quem renova em dois produtos do
ciclo gera 2 pontos na curva e 1 linha no roster. A divergência já existia antes
(alguém que compra duas vezes no mesmo produto) — o multi-produto só a torna mais
frequente.

**As RPCs continuam escopadas por produto, não por ciclo.** Não há janela de
início/fim no schema, então `daily` e `hourly` devolvem todo o histórico dos
produtos, não o recorte do ciclo. É a issue #142, anterior a esta feature; o
multi-produto não a piora nem a resolve.

---

## Rollback

**Com perda.** O bloco `DOWN` da `056` está no rodapé do arquivo, em 8 passos.

Ciclos multi-produto **não têm representação** na coluna escalar: recriar
`product_id` obriga a escolher um produto do conjunto, e os demais são
descartados. Depois do rollback, um ciclo criado com 3 produtos vira um ciclo de
1 produto, silenciosamente.

Atenção ao passo 7: `dash_gestao_ultimates_offer_options` teve o `RETURNS TABLE`
alterado por esta migration, então o rollback dela exige `drop function` antes do
`create` — `CREATE OR REPLACE` não troca tipo de retorno — e a reaplicação dos
`revoke`/`grant`, que o `DROP` destrói. Sem isso a função volta sem permissão
para o `service_role` e toda leitura de oferta quebra com "permission denied".

---

## Conflito de merge conhecido

A feature paralela `feat/ultimates-editar-roster` cria
`src/app/api/ultimates/cycles/[id]/excluded-buyers/route.ts`, que lê
`.select("id, product_id, status")` em três pontos, e reservou a migration `055`
(por isso esta é a `056`).

Aqueles arquivos não existiam na `main` quando esta feature foi escrita, então
estão fora do escopo dela. **Quem mergear por último precisa aplicar ali a mesma
troca** que a Task 6 fez em `excluded-offers/route.ts`: parar de ler
`cycle.product_id` e validar pertinência ao conjunto lido de
`dash_gestao_ultimates_cycle_products`. Sem isso, aquela rota quebra no instante
em que a `056` rodar.
