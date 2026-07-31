# Dash Ultimates — ciclo com múltiplos produtos

**Spec:** `docs/superpowers/specs/2026-07-30-ultimates-multi-produto-design.md`
**Migration:** `057_ultimates_multi_produto.sql`
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

**A fila é `052 → 053 → 054 → 055 → 056 → 057`.** A `057` **precisa** vir depois
da `055` (leads excluídos) e da `056` (identidade do comprador), porque reescreve
três funções que aquelas duas definiram. Aplicada fora de ordem, o erro é
barulhento — o Postgres recusa mudar o tipo de retorno de uma função existente —
mas não confie nisso: aplique na ordem.

Se houver dúvida sobre o que já subiu neste ambiente, confira antes. Havia
registro de que a fila estava atrasada.

A `057` faz, **nesta ordem, dentro do mesmo arquivo**: cria a junção → faz o
backfill dos ciclos existentes → substitui as 4 RPCs de leitura → dropa a coluna
→ cria a RPC de criação atômica.

**Não suba o código antes da migration, nem a migration antes do código.** As
rotas migradas leem a junção (que não existe antes da `057`); as rotas antigas
leem a coluna (que não existe depois). A janela entre as duas é de
indisponibilidade do módulo.

---

## Checklist de validação manual

Nada disto é coberto por teste automatizado: a suíte roda com o client Supabase
mockado, então **nenhuma das 4 RPCs reescritas é exercitada por teste**. Esta é a
única verificação real da mudança de maior risco.

### 1. Regressão de ciclo mono-produto (o teste que importa)

Escolha um ciclo que tenha, ao mesmo tempo, **pelo menos um lead excluído e pelo
menos um vínculo manual**. Isso não é detalhe: um ciclo sem esses dois casos passa
no teste mesmo que a `057` tenha revertido os filtros que a `055` introduziu.

**Antes** de aplicar a `057`, anote: base, renovados, % de renovação, renovação
reembolsada, não renovados, novos compradores, e o total ao fim da curva nas
visões **dia** e **hora**. Anote também que o lead excluído não aparece no roster
e que a renovação vinda de vínculo manual oferece "Desfazer vínculo".

Aplique a `057`. Recarregue o mesmo ciclo. Tudo tem que ser **idêntico**.

O que cada divergência significa:

- **números inflados**, tipicamente múltiplo exato do original → `cross join`
  sobrevivente numa das RPCs. Era o risco central da feature: as versões
  anteriores usavam `cross join cyc` com um CTE de uma linha, e com N produtos
  isso multiplicaria cada venda por N, **sem erro e sem exceção**;
- **o lead excluído reapareceu** no roster, ou a compra dele voltou como "novo
  comprador" → a `057` sobrescreveu os filtros da `055`;
- **"Desfazer vínculo" aparece em toda renovação** → a coluna `from_manual_link`
  se perdeu;
- **nome e telefone de novo comprador em branco** → os campos que a `056`
  introduziu se perderam.

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
produto. Um ciclo com muitos produtos e muito histórico ainda pode estourar e
virar 502. Aumentar o orçamento exige rever `LOCK_TTL_MS` (90s) e `maxDuration`
(60s) juntos; ficou deliberadamente fora do escopo.

O que **deixou** de acontecer: a falha de um produto não descarta mais o que os
anteriores já trouxeram. As vendas são gravadas produto a produto, então uma
retentativa avança em vez de repetir do zero — antes, os produtos do fim da lista
nunca recebiam venda nenhuma.

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

**Com perda.** O bloco `DOWN` da `057` está no rodapé do arquivo.

Ciclos multi-produto **não têm representação** na coluna escalar: recriar
`product_id` obriga a escolher um produto do conjunto, e os demais são
descartados. Depois do rollback, um ciclo criado com 3 produtos vira um ciclo de
1 produto, silenciosamente.

O rollback precisa reaplicar `roster` na versão da **`056`** e `daily`/`hourly` na
versão da **`055`** — não as versões da `052`/`054`, que são anteriores aos leads
excluídos e à identidade do comprador. Voltar às versões erradas reverteria duas
features em silêncio.

Atenção também a `dash_gestao_ultimates_offer_options`: a `057` alterou o
`RETURNS TABLE` dela, então o rollback exige `drop function` antes do `create` —
`CREATE OR REPLACE` não troca tipo de retorno — e a reaplicação dos
`revoke`/`grant`, que o `DROP` destrói. Sem isso a função volta sem permissão para
o `service_role` e toda leitura de oferta quebra com "permission denied".
