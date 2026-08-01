# Dash Ultimates — ciclo com múltiplos produtos

**Spec:** `docs/superpowers/specs/2026-07-30-ultimates-multi-produto-design.md`
**Migration:** `061_ultimates_multi_produto.sql`
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

> Editar o conjunto de produtos de um ciclo existente é a **PR seguinte**, não
> esta. Ela depende desta ter subido e sido validada.

### Mudança estrutural

`dash_gestao_ultimates_cycles.product_id` **deixou de existir**. A fonte de
verdade agora é a tabela de junção `dash_gestao_ultimates_cycle_products`.

Quem for ler ciclos direto do banco precisa saber disso: um `select product_id
from dash_gestao_ultimates_cycles` que funcionava antes agora falha.

---

## Por que `061` e não a `057` do PR #148

A `057` foi escrita quando a main estava na `056` e **nunca chegou a ser
aplicada**. Depois disso a main andou 19 commits e ganhou três migrations. A
`057` não sabe delas, e aplicá-la hoje faria duas coisas ruins — nenhuma
barulhenta:

1. A **`058`** substituiu `roster(uuid)` por `roster(uuid, date, date)`. O
   `create or replace function roster(p_cycle_id uuid)` da `057` não
   substituiria nada: criaria uma **segunda sobrecarga**, e toda chamada de
   roster passaria a ser ambígua.
2. A **`060`** criou `dash_gestao_ultimates_sync_buyers_from_sales`, que lê
   `cycles.product_id`. A `057` não a conhece e dropa a coluna assim mesmo. O
   Postgres não rastreia dependência de coluna dentro de corpo de função
   `language sql` com corpo em string, então o `DROP` passa limpo e a
   materialização do modo Apenas Compras só quebra **em runtime**, na primeira
   chamada.

A `061` parte dos corpos **vivos** de cada função e aplica sobre eles a única
diferença que a feature exige. São **cinco** funções reescritas, não quatro:

| Função | Corpo de origem |
| --- | --- |
| `dash_gestao_ultimates_roster` | `058` (recorte por intervalo, 3 args) |
| `dash_gestao_ultimates_daily` | `055` |
| `dash_gestao_ultimates_hourly` | `055` |
| `dash_gestao_ultimates_offer_options` | `052` |
| `dash_gestao_ultimates_sync_buyers_from_sales` | `060` |

A `057` **não faz parte desta PR** — o arquivo não existe neste branch.

---

## Ordem de aplicação — importa

Neste ambiente, `049`→`056`, `058`, `059` e `060` **já estão aplicadas**
(conferido no banco). A `061` é a única pendente e vai por último.

Se a fila estiver diferente em outro ambiente, aplique tudo até a `060` antes.
A `061` reescreve funções que a `055`, a `058` e a `060` definiram; fora de
ordem o erro é barulhento — o Postgres recusa mudar o tipo de retorno de uma
função existente — mas não confie nisso.

A `061` faz, **nesta ordem, dentro do mesmo arquivo**: cria a junção → faz o
backfill dos ciclos existentes → substitui as 5 RPCs de leitura/escrita → dropa
a coluna → cria a RPC de criação atômica.

**Não suba o código antes da migration, nem a migration antes do código.** As
rotas migradas leem a junção (que não existe antes da `061`); as rotas antigas
leem a coluna (que não existe depois). A janela entre as duas é de
indisponibilidade do módulo.

---

## Checklist de validação manual

Nada disto é coberto por teste automatizado: a suíte roda com o client Supabase
mockado, então **nenhuma das 5 RPCs reescritas é exercitada por teste**. Esta é a
única verificação real da mudança de maior risco.

### 1. Regressão de ciclo mono-produto (o teste que importa)

Escolha um ciclo que tenha, ao mesmo tempo, **pelo menos um lead excluído e pelo
menos um vínculo manual**. Isso não é detalhe: um ciclo sem esses dois casos passa
no teste mesmo que a `061` tenha revertido os filtros que a `055` introduziu.

**Antes** de aplicar a `061`, anote: base, renovados, % de renovação, renovação
reembolsada, não renovados, novos compradores, e o total ao fim da curva nas
visões **dia** e **hora**. Anote também que o lead excluído não aparece no roster,
que a renovação vinda de vínculo manual oferece "Desfazer vínculo", e o resultado
do **filtro de datas** num intervalo qualquer.

Aplique a `061`. Recarregue o mesmo ciclo. Tudo tem que ser **idêntico**.

O que cada divergência significa:

- **números inflados**, tipicamente múltiplo exato do original → `cross join`
  sobrevivente numa das RPCs. Era o risco central da feature: as versões
  anteriores usavam `cross join cyc` com um CTE de uma linha, e com N produtos
  isso multiplicaria cada venda por N, **sem erro e sem exceção**;
- **o filtro de datas parou de recortar**, ou a rota devolve 501 → o corpo do
  roster voltou para uma versão anterior à `058`;
- **o lead excluído reapareceu** no roster, ou a compra dele voltou como "novo
  comprador" → a `061` sobrescreveu os filtros da `055`;
- **"Desfazer vínculo" aparece em toda renovação** → a coluna `from_manual_link`
  se perdeu;
- **nome e telefone de novo comprador em branco** → os campos que a `056`
  introduziu se perderam.

### 2. Modo Apenas Compras continua materializando

Num ciclo `purchases_only`, clique em **"Atualizar agora"** e confirme que o
roster continua sendo preenchido. É a checagem específica da `060`: se
`sync_buyers_from_sales` tivesse ficado lendo a coluna dropada, o sintoma seria
um 502 com "Sync buyers error: column c.product_id does not exist" — e só aqui.

Confirme também que um nome ou telefone **corrigido à mão** sobrevive ao refresh
(a RPC é aditiva por contrato).

### 3. Caminho novo

1. Criar um ciclo com 2 produtos da mesma conta → salva e abre o dashboard com os
   dois nomes no header.
2. Criar um ciclo com "Apenas Compras" ligado e 2 produtos → a flag persiste (ela
   agora viaja pela RPC de criação, junto com o conjunto de produtos).
3. Tentar selecionar um produto de outra conta → botão desabilitado, com o motivo
   no `title`.
4. Subir a base de compradores e conferir que um email com compra nos **dois**
   produtos aparece **uma vez** no roster, com `total_value` somado.
5. Abrir "Ofertas excluídas" → ofertas dos dois produtos na lista, cada linha
   mostrando de qual produto é.
6. "Atualizar agora" → sucesso, com `upserted` cobrindo os dois produtos.

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

**`daily` e `hourly` continuam sem recorte de janela.** Não há início/fim de
ciclo no schema, então elas devolvem todo o histórico dos produtos. É a issue
#142, anterior a esta feature; o multi-produto não a piora nem a resolve. O
roster tem recorte próprio desde a `058`.

---

## Rollback

**Com perda.** O bloco `DOWN` da `061` está no rodapé do arquivo.

Ciclos multi-produto **não têm representação** na coluna escalar: recriar
`product_id` obriga a escolher um produto do conjunto, e os demais são
descartados. Depois do rollback, um ciclo criado com 3 produtos vira um ciclo de
1 produto, silenciosamente.

O rollback precisa reaplicar cada função **a partir do arquivo de origem listado
na tabela acima** — `roster` da `058`, `daily`/`hourly` da `055`,
`offer_options` da `052`, `sync_buyers_from_sales` da `060`. Reaplicar versões
mais antigas reverteria features em silêncio.

Atenção também a `dash_gestao_ultimates_offer_options`: a `061` alterou o
`RETURNS TABLE` dela, então o rollback exige `drop function` antes do `create` —
`CREATE OR REPLACE` não troca tipo de retorno — e a reaplicação dos
`revoke`/`grant`, que o `DROP` destrói. Sem isso a função volta sem permissão para
o `service_role` e toda leitura de oferta quebra com "permission denied".
