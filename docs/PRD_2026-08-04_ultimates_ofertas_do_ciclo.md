# PRD — Dash Ultimates: o ciclo passa a acompanhar ofertas, não produtos inteiros

**Date:** 2026-08-04
**Status:** Approved (decisões validadas em entrevista com o owner)
**Owner:** Alberani
**Depende de:** migrations 049–064 aplicadas (fila deste ambiente: 061 → 062 → 063 → 064)
**Substitui:** PRD 2026-07-30 "excluir ofertas da contabilidade" (issue de origem da migration 052)

## 1. Contexto e problema

Hoje um ciclo é definido por um conjunto de **produtos** (`dash_gestao_ultimates_cycle_products`, migration 061). Toda venda desses produtos entra na contabilidade, e o único recorte por oferta é uma **lista de exclusão** (`dash_gestao_ultimates_excluded_offers`, migration 052): conta tudo, menos o que alguém lembrou de tirar.

O default dessa lista é permissivo, e é aí que ele falha. Oferta de cortesia criada depois da montagem do ciclo entra sozinha nos KPIs. Oferta de teste de um lançamento entra sozinha. Ninguém é avisado — o número simplesmente fica maior, e a descoberta acontece batendo com o painel da Hotmart, se acontecer.

**Objetivo:** inverter o default. O ciclo passa a acompanhar um conjunto **explícito** de ofertas, escolhido por um gestor. Venda de oferta não escolhida não conta, e produto sem nenhuma oferta escolhida impede a criação do ciclo.

**Reversão declarada:** o PRD de 2026-07-30 registrou "Whitelist (lista de ofertas válidas)" como fora de escopo, com a justificativa de que a manutenção da lista seria maior que o problema. Um mês de uso mostrou o inverso: o custo do default permissivo não é de manutenção, é de confiança no número. Esta é uma reversão consciente daquela decisão, não um esquecimento dela.

## 2. Escopo

### Incluído

- Nova tabela `dash_gestao_ultimates_cycle_offers`: as ofertas que o ciclo acompanha.
- Coluna `include_offerless` em `dash_gestao_ultimates_cycle_products`: a decisão explícita sobre venda sem `offer_code`.
- Inversão do filtro em `dash_gestao_ultimates_cycle_sales` (fonte única de vendas desde a 064) e em `dash_gestao_ultimates_sync_buyers_from_sales`.
- Validação "todo produto precisa de ≥1 oferta" no form e nas RPCs de criação/edição.
- Escolha de ofertas dentro do `CycleFormModal`, na criação **e** na edição.
- Estado "ofertas não configuradas" no dashboard, substituindo todos os números.
- Aviso de oferta nova fora da contabilidade.
- Remoção completa da feature "Ofertas excluídas" (tabela, modal, 2 endpoints, guard de vínculo), com dump prévio para tabela de arquivo morto.

### Fora de escopo

| Item | Motivo |
|---|---|
| Escopo global / outros dashboards | A allowlist é **por ciclo**. Indicadores, dashboard Hotmart e `get_hotmart_metrics` seguem intocados |
| Alterar a coleta Hotmart | Crons, webhook e "Atualizar agora" continuam gravando **todas** as vendas — é o que mantém a escolha reversível |
| Entrada automática de oferta nova | Rejeitado: seria o default permissivo de volta, com outro nome. Oferta nova gera **aviso**, nunca contagem |
| Histórico de alterações da allowlist | A tabela guarda o estado vigente. Sem trilha de auditoria própria, como no unlink de vínculo manual |
| Escolha de oferta por período | A oferta vale para o ciclo inteiro; recorte temporal continua sendo o período do ciclo (migration 063) |

## 3. Regras de negócio

### 3.1 O filtro (inversão)

Uma venda **conta** quando `offer_code` está em `dash_gestao_ultimates_cycle_offers` do ciclo, **ou** quando `offer_code is null` e o produto dela tem `include_offerless = true`.

Todo o resto é descartado no CTE que monta o universo de vendas, **antes** de qualquer atribuição a comprador — mesma precedência que a blocklist tinha (decisão 4 do PRD anterior). Vínculo manual apontando para venda de oferta não escolhida sobrevive na tabela sem efeito, e volta a valer se a oferta for marcada.

Nada é apagado em `dash_gestao_hotmart_sales`. A classificação continua **derivada em leitura**, e marcar/desmarcar oferta é integralmente reversível na leitura seguinte — sem refresh, sem reprocessamento.

### 3.2 Todo produto precisa de uma escolha

Um produto do ciclo é **configurado** quando tem ≥1 linha em `cycle_offers` **ou** `include_offerless = true`.

Ciclo com qualquer produto não configurado **não salva** — nem na criação, nem na edição. Validado no form (pela mensagem) e nas RPCs `create_cycle` / `set_cycle_products` (pela invariante). A validação da RPC não pode ser removida confiando na do form, mesmo padrão da checagem de conta única em `/api/ultimates/cycles`.

> **Decisão derivada — confirmar na revisão:** marcar apenas `(sem oferta)`, sem nenhuma oferta real, satisfaz a regra. O que o requisito protege é a **escolha humana explícita**, e marcar `(sem oferta)` é uma. Um produto cujas vendas não têm `offer_code` seria, na leitura oposta, impossível de acompanhar.

### 3.3 Venda sem `offer_code`

Existe: `mapHotmartSaleItem` grava `item.purchase.offer?.code ?? null`. Hoje ela sempre conta — a blocklist nunca a pegou, e a 052 diz isso em comentário.

Sob allowlist ela não casaria com nada, e sumiria sem que nenhuma tela pudesse resgatá-la. Por isso a lista de ofertas de cada produto exibe uma linha fixa **`(sem oferta)`**, com a contagem de vendas nessa condição, marcável como qualquer outra.

### 3.4 Ciclo sem ofertas configuradas

Estado **derivado**, não uma coluna: um ciclo está não configurado quando algum produto seu não tem escolha. Como a validação impede salvar nesse estado, os únicos ciclos assim são os que existiam antes desta migration.

Nesse estado o dashboard **não mostra número nenhum** — nem os antigos, nem zerados. KPIs, gráfico, roster e origem dão lugar a um bloco único (ver 4.3).

Continuam liberados: "Atualizar agora", período do ciclo e carregar base. Coletar venda é inofensivo (a allowlist filtra na leitura), e travar a coleta só atrasaria o dado que o gestor vai querer ver assim que configurar.

### 3.5 Desmarcar oferta em ciclo Apenas Compras

Em ciclo `purchases_only` o roster é **materializado** a partir das vendas (migration 060, `from_sales`). Desmarcar uma oferta tem o mesmo efeito que remover um produto: quem só comprou por ela fica sem venda contável e viraria linha fantasma contando nos KPIs.

Portanto desmarcar oferta passa **pelo mesmo caminho da migration 062**:

1. reconta as vendas contáveis dos produtos e ofertas que sobraram;
2. apaga apenas linhas com `from_sales = true` que ficaram sem venda nenhuma;
3. preserva linhas do gestor (`from_sales = false`) intactas;
4. exige **segundo clique**, nomeando as ofertas que saem, antes de executar.

O segundo clique não é cerimônia: o `CycleFormModal` é aberto por rotina para renomear ciclo ou mudar meta, e um clique errado numa sanfona não pode custar linha de roster.

### 3.6 Ciclo encerrado

Ofertas ficam **read-only**, exibidas mas não editáveis, com o mesmo texto que já vale para produtos: *"Ciclo encerrado — reative o ciclo para alterar as ofertas."* Trocar oferta reescreveria de uma vez todos os números de um histórico fechado.

### 3.7 Papéis

`gestor` configura. `analista` vê a lista sem editar. `comum` segue sem acesso ao módulo. O gate real é dos endpoints; a tela só espelha.

## 4. Experiência do usuário

### 4.1 Escolha de ofertas no `CycleFormModal`

Sanfona sob cada produto selecionado, recolhida por padrão, com contador no cabeçalho:

```
Produtos Hotmart (1 ou mais)
[buscar...]
┌──────────────────────────────┐
│ ✓ Ultimates Anual   1234567 │
│   ▼ 2 de 5 ofertas          │
│     ✓ Oferta Principal  312 │
│     ✓ Black Friday      140 │
│     ☐ Cortesia Equipe     8 │
│     ☐ (sem oferta)        3 │
├──────────────────────────────┤
│ ✓ Ultimates Mensal  7654321 │  ← borda de erro
│   ▼ 0 de 3 ofertas          │
│   Selecione ao menos 1      │
└──────────────────────────────┘
```

- A lista mostra **todas** as ofertas do produto, inclusive `is_active = false` e inclusive as com zero venda — oferta nova precisa ser marcável antes de vender, e oferta desativada precisa ser reconhecível.
- O número ao lado é a contagem de vendas **de todo o histórico do produto, sem recorte de data**, igual ao seletor que existe hoje. Ele serve para reconhecer a oferta, não para conferir conta — e no momento da criação não existe período de ciclo para recortar.
- Ordenação por nº de vendas (desc), depois nome — mesma ordem da `offer_options` atual.
- Marcar/desmarcar produto não descarta as ofertas já escolhidas dele na sessão do modal: remarcar o produto devolve a seleção, evitando que um clique errado apague trabalho.
- Produto sem escolha ganha borda de erro **no próprio item**, e o erro do rodapé nomeia quais produtos faltam.

### 4.2 Sanfona na edição

Idêntica à criação, com o estado atual do ciclo pré-marcado (aqui **sim** há o que pré-marcar: é a configuração vigente). Desmarcar oferta dispara a confirmação de 3.5.

### 4.3 Dashboard sem ofertas configuradas

No lugar de KPIs, gráfico, roster e origem:

> **Ofertas não configuradas**
> Este ciclo ainda não tem ofertas escolhidas, então nenhum número pode ser calculado.
> — `gestor`: botão **"Configurar ofertas"**, que abre o `CycleFormModal` em edição.
> — `analista`: *"Peça a um gestor para configurar as ofertas deste ciclo."*

A barra de ações e o seletor de ciclo continuam visíveis: quem caiu aqui precisa poder trocar de ciclo sem recarregar a página.

### 4.4 Aviso de oferta nova

Com o ciclo configurado, o dashboard compara as ofertas com venda no período contra a allowlist. Havendo diferença, faixa no topo da seção **01 Visão do ciclo**:

> ⚠ **2 ofertas fora da contabilidade (14 vendas)** — Cortesia Black · Upsell V2. [Revisar]

Sem diferença, nada é exibido — mesmo princípio da nota de recorte por data, que só aparece quando há recorte.

Esta faixa é a **única** proteção contra a subnotificação silenciosa da allowlist, e não é opcional: `upsertPlaceholderOffers` cria oferta a partir de venda, então toda oferta nova nasce fora da contabilidade por construção.

## 5. Modelo de dados (migration 065)

```sql
-- Ofertas que o ciclo acompanha.
create table dash_gestao_ultimates_cycle_offers (
  cycle_id   uuid not null,
  product_id text not null,
  offer_code text not null references dash_gestao_hotmart_offers(offer_code),
  created_at timestamptz not null default now(),
  primary key (cycle_id, offer_code),
  -- FK composta para cycle_products, e não para cycles: garante que a oferta
  -- escolhida pertence a um produto QUE ESTÁ no ciclo, e o cascade tira a
  -- oferta junto quando o produto sai. Sem isso, remover produto deixaria
  -- oferta órfã apontando para um universo que não existe mais.
  foreign key (cycle_id, product_id)
    references dash_gestao_ultimates_cycle_products(cycle_id, product_id)
    on delete cascade
);

-- A decisão sobre venda sem offer_code, por produto do ciclo.
-- default false = "não escolhida", que é o estado correto para todo ciclo
-- existente: ninguém escolheu ainda.
alter table dash_gestao_ultimates_cycle_products
  add column include_offerless boolean not null default false;

-- Arquivo morto da blocklist, ANTES do drop.
create table dash_gestao_ultimates_excluded_offers_archive (like ... );
insert into ..._archive select * from dash_gestao_ultimates_excluded_offers;
```

`offer_code` na PK sem `product_id` porque `dash_gestao_hotmart_offers.offer_code` é **unique global** — a mesma oferta não pertence a dois produtos, e uma PK com `product_id` permitiria duas linhas contraditórias.

**Nenhum backfill de ofertas.** Todo ciclo existente acorda com `cycle_offers` vazia e `include_offerless = false`, ou seja, não configurado. É a decisão da entrevista: quem reconfigura escolhe do zero, sem herdar um conjunto que ninguém leu.

O arquivo morto não tem FK, não tem leitor no código e não tem policy de select. Existe para responder *"por que essa oferta estava fora"* depois que a tabela viva sumir.

### Funções afetadas — cinco, não nove

A migration 064 centralizou o universo de vendas: `roster`, `daily`, `hourly` e `purchases` **consomem** `dash_gestao_ultimates_cycle_sales` e não escrevem mais filtro de venda. Logo:

| Função | Mudança |
|---|---|
| `dash_gestao_ultimates_cycle_sales` (064) | Troca o `not exists (excluded_offers)` pelo `exists (cycle_offers) or (offer_code is null and include_offerless)`. **É o único ponto de leitura.** |
| `dash_gestao_ultimates_sync_buyers_from_sales` (062) | Mesma inversão — tem CTE próprio, não passa por `cycle_sales` |
| `dash_gestao_ultimates_set_cycle_products` (062) | Passa a receber ofertas, valida a invariante e reconta usando o universo novo |
| `dash_gestao_ultimates_create_cycle` (061) | Passa a receber ofertas e valida a invariante |
| `dash_gestao_ultimates_offer_options` (052) | Deixa de ser escopada por `p_cycle_id`: no create ainda não existe ciclo. Vira escopada por `product_ids[]`, e passa a devolver a contagem de `offer_code is null` por produto |

Cuidado herdado da 061: toda referência de coluna dentro das funções precisa ser qualificada — `RETURNS TABLE` põe os nomes de saída em escopo e um `product_id` solto vira erro de ambiguidade.

## 6. API

| Rota | Mudança |
|---|---|
| `GET /api/ultimates/offer-options?productIds=a,b` | **Nova.** Alimenta a sanfona antes do ciclo existir |
| `POST /api/ultimates/cycles` | Aceita `offers` (por produto) e rejeita produto sem escolha |
| `PATCH /api/ultimates/cycles/[id]` | Idem, e devolve os compradores removidos pela recontagem |
| `GET /api/ultimates/cycles/[id]/offer-options` | **Removida** — substituída pela rota por produto |
| `GET/POST/DELETE .../excluded-offers` | **Removidas** |
| `POST /api/ultimates/links` | O guard deixa de consultar a blocklist e passa a exigir que a venda esteja numa oferta escolhida |

## 7. Plano de deploy

**Este deploy escurece todos os dashboards ativos ao mesmo tempo.** Não é efeito colateral — é a decisão da entrevista, tomada para garantir que nenhuma oferta conte sem alguém ter olhado para ela.

1. Aplicar a 065 (a fila 061→062→063→064 já está aplicada neste ambiente).
2. Deploy do código. A partir daqui, **todo ciclo mostra "Ofertas não configuradas"**.
3. Avisar os gestores **antes** do passo 2, não depois.
4. Cada ciclo ativo é reconfigurado por um gestor: abrir → marcar ofertas → salvar.
5. Conferir um ciclo já configurado contra o painel da Hotmart antes de declarar a migração boa.

Documentar em `docs/OPS_2026-08-04_*.md`, no padrão das OPS anteriores do módulo.

## 8. Riscos

| Risco | Mitigação |
|---|---|
| **Oferta nova subnotifica em silêncio** — o modo de falha nativo da allowlist | Faixa de aviso (4.4). Sem ela a feature troca um erro visível por um invisível |
| **Reinclusão de oferta de cortesia** na reconfiguração do zero | Só o arquivo morto, consultável via SQL. Foi decisão explícita não trazer selo de "estava excluída" para a tela |
| **Todos os dashboards escuros no deploy** | Passo 3 do plano. Se a janela for ruim, adiar o deploy é preferível a adiar o aviso |
| **Perda de roster por desmarcar oferta** em Apenas Compras | Recontagem + segundo clique (3.5), reusando o caminho já validado da 062 |
| **Ciclo com muitas ofertas** deixa a sanfona longa | Recolhida por padrão, com contador; a busca de produto já existente permanece |

## 9. Decisões da entrevista

1. **Allowlist**, não validação de existência nem realocação do modal atual. Ofertas passam a definir o universo do ciclo.
2. **Backfill + reconfiguração forçada** para ciclos existentes, em vez de conviver com duas semânticas nas RPCs.
3. **Nada pré-marcado** na reconfiguração — o gestor escolhe do zero. Consequência aceita: não há backfill de ofertas, só o estado bloqueado.
4. **Dashboard sem número nenhum** enquanto não configurado. Zero seria lido como operação morta; número antigo seria mentira.
5. **`(sem oferta)` é item marcável**, não regra implícita. Custa um booleano e impede que venda suma sem alguém ver que ela existia.
6. **Blocklist morre inteira no mesmo PR**, com dump para arquivo morto antes do drop.
7. **Sanfona por produto** dentro do form, não wizard nem modal sobre modal: o erro "produto sem oferta" aparece onde ele nasce.
8. **Oferta nova avisa, não bloqueia.** Derrubar o ciclo para o estado bloqueado apagaria o painel no meio de um lançamento.
9. **Desmarcar oferta reusa a recontagem da 062**, com segundo clique.

## 10. Testes

- **RPC (`cycle_sales`)**: venda de oferta marcada conta; de não marcada não conta; com `offer_code` null conta **apenas** com `include_offerless = true`. Prova de mutação obrigatória — a suíte é transpile-only (`isolatedModules`), então teste novo só vale com a mutação demonstrada.
- **Invariante**: `create_cycle` e `set_cycle_products` levantam exceção com produto sem escolha, mesmo com o form fora do caminho.
- **Recontagem**: em ciclo `purchases_only`, desmarcar oferta apaga linha `from_sales` sem venda restante e **preserva** linha do gestor com o mesmo email.
- **Form**: salvar bloqueado com produto sem oferta; desmarcar exige segundo clique; ciclo encerrado renderiza read-only.
- **Dashboard**: estado não configurado não renderiza KPI, gráfico nem roster; faixa de oferta nova aparece só com diferença real.
