# Dash Ultimates — o ciclo passa a acompanhar ofertas

**Migration:** `065_ultimates_ofertas_do_ciclo.sql`
**PRD:** issue #165 — `docs/PRD_2026-08-04_ultimates_ofertas_do_ciclo.md`
**Depende de:** `061` → `062` → `063` → `064` aplicadas
**Status:** implementado; **validação manual com dados reais pendente** (checklist abaixo)

---

## ⚠ Leia isto antes de aplicar

**Este deploy apaga os números de todos os dashboards ativos ao mesmo tempo.**

Não é efeito colateral nem bug: é a decisão central da feature. Todo ciclo
existente acorda com allowlist vazia e mostra *"Ofertas não configuradas"* até
que um gestor escolha as ofertas dele. Não há backfill — quem reconfigura
escolhe do zero, de propósito, para que nenhuma oferta conte por herança.

**Avise os gestores ANTES de aplicar, não depois.** Um dashboard que fica sem
número sem aviso prévio é lido como sistema quebrado, e o suporte que isso gera
custa mais que o aviso.

---

## O que mudou

Antes: o ciclo acompanhava **produtos inteiros**, e toda venda deles contava,
menos as ofertas que alguém lembrasse de pôr numa lista de exclusão.

Agora: o ciclo acompanha um conjunto **explícito de ofertas**. Venda de oferta
que ninguém escolheu não conta em KPI, gráfico, roster, curva por hora nem
origem.

A inversão do default é o ponto. A lista de exclusão errava para o lado de
contar demais — oferta de cortesia criada depois da montagem do ciclo entrava
sozinha e ninguém era avisado. A allowlist erra para o lado de contar de menos,
que é o erro que dá para ver.

### A feature "Ofertas excluídas" foi removida

Tabela, modal, os dois endpoints e o guard de vínculo manual. Antes do drop, a
migration copia as linhas para `dash_gestao_ultimates_excluded_offers_archive` —
sem FK, sem leitor no código, sem policy de select. Ela existe só para responder
*"por que essa oferta estava fora"* via SQL depois que a tabela viva sumir:

```sql
select * from dash_gestao_ultimates_excluded_offers_archive where cycle_id = '...';
```

Não confunda com **"Leads excluídos"** (`excluded_buyers`), que é outra feature e
continua viva.

---

## A parte que não é óbvia: três estados, não dois

Cada oferta de cada produto do ciclo está num de **três** estados, e a diferença
entre os dois últimos é o que faz a feature não virar ruído.

| Estado | No banco | Conta? | Alerta? |
|---|---|---|---|
| Escolhida | `cycle_offers` com `included = true` | sim | não |
| Vista e recusada | `cycle_offers` com `included = false` | não | **não** |
| Nunca decidida | sem linha nenhuma | não | **sim** |

Se a tabela guardasse só as escolhidas, o dashboard não saberia distinguir *"a
oferta é nova"* de *"o gestor recusou de propósito"* — e a cortesia que você
desmarcou hoje alertaria para sempre. Um aviso que sempre grita para de ser
lido, e a rede de proteção da allowlist morre junto.

O mesmo vale para venda **sem `offer_code`**: `include_offerless` é *nullable*,
onde `null` = ninguém decidiu ainda.

### Por isso o cliente envia `rejected_offer_codes`

"Vista e recusada" é um fato sobre a **tela**, não sobre o banco. O servidor não
tem como derivar de *"não está na lista de escolhidas"* se o gestor olhou para
aquela oferta e disse não, ou se ela nem existia quando ele configurou. Por isso
o form envia as duas listas.

---

## Desmarcar oferta apaga linha de roster

Só em ciclo **Apenas Compras**, e pela mesma mecânica que remover produto já
tinha (migration 062): o roster é materializado a partir das vendas, então quem
só comprou pela oferta desmarcada fica sem venda contável e viraria linha
fantasma somando nos KPIs.

A linha é apagada se — e só se — as duas forem verdadeiras:

1. **foi materializada** (`from_sales = true`), nunca uma linha que o gestor
   subiu ou corrigiu à mão;
2. **não tem mais nenhuma venda contável** no universo que sobrou (produtos **e**
   ofertas).

Por isso o form exige **segundo clique** quando alguma oferta sai, nomeando
quais. O modal de ciclo é aberto por rotina — para renomear, para mudar meta — e
um clique errado numa sanfona não pode custar roster.

---

## Ordem de aplicação

1. Confirmar que `061`, `062`, `063` e `064` estão aplicadas neste ambiente.
2. **Avisar os gestores** que os dashboards ficarão sem número até a
   reconfiguração.
3. Aplicar `065_ultimates_ofertas_do_ciclo.sql`.
4. Deploy do código. A partir daqui todo ciclo mostra *"Ofertas não
   configuradas"*.
5. Reconfigurar cada ciclo ativo: abrir o ciclo → **Configurar ofertas** → marcar
   → salvar.

A migration precisa ir **antes** do código. O GET dos ciclos passa a ler a tabela
e a coluna novas; sem elas aplicadas, o dashboard responde erro de carga em vez
de degradar.

---

## Checklist de validação com dados reais

Nada aqui foi conferido contra o banco de produção — a migration não foi
aplicada.

- [ ] Um ciclo existente mostra *"Ofertas não configuradas"* logo após o deploy,
      sem nenhum número na tela.
- [ ] `gestor` vê o botão **Configurar ofertas**; `analista` vê a instrução de
      procurar um gestor.
- [ ] Configurar um ciclo e **bater o KPI contra o painel da Hotmart**, filtrando
      pelas mesmas ofertas. Este é o teste que vale.
- [ ] Criar ciclo com um produto e nenhuma oferta marcada → o form recusa, e a
      RPC também recusa (testar com `curl` direto na rota, com o form fora do
      caminho).
- [ ] Produto com venda sem `offer_code`: a linha **(sem oferta)** aparece com a
      contagem certa e, marcada, traz as vendas de volta.
- [ ] Em ciclo **Apenas Compras**: desmarcar uma oferta exige segundo clique,
      apaga só as linhas materializadas sem venda restante e **preserva** uma
      linha corrigida à mão com o mesmo email.
- [ ] Criar uma oferta nova na Hotmart, rodar o sync, confirmar que a faixa de
      aviso aparece com a contagem — e que ela **não** aparece para uma oferta
      recusada de propósito.
- [ ] Ciclo encerrado mostra as ofertas como texto, sem permitir edição.
- [ ] Vínculo manual em venda de oferta não escolhida é recusado com mensagem
      legível.
- [ ] `dash_gestao_ultimates_excluded_offers_archive` tem as linhas que a tabela
      viva tinha antes do drop.
