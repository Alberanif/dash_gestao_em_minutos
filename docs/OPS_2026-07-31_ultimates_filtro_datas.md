# OPS — Filtro seletor de datas no Dash Ultimates

**Data:** 2026-07-31
**Branch:** `feat/ultimates-filtro-datas`
**Spec:** `docs/SPEC_2026-07-31_ultimates_filtro_datas.md`

## O que subiu

Uma barra `De / Até / Aplicar / Limpar` no dashboard do ciclo em `/ultimates`. Com
intervalo aplicado:

- **Recortados pelo período:** tiles Renovados, Renovação reembolsada e Novos Compradores
  (ou Renovações sem vínculo), o gráfico "Evolução" nas duas granularidades, e a tabela do
  roster — que passa a listar só quem teve venda na janela.
- **Não recortados, seguem o ciclo inteiro:** tiles Base e Não renovados, e a barra de meta.

O recorte misto é anunciado no card 01. O intervalo é salvo em `localStorage`, chave
`ultimates-date-range`, e sobrevive a recarga e a troca de ciclo.

## Pré-requisito de deploy: migration 058

`supabase/migrations/058_ultimates_roster_date_range.sql` **precisa ser aplicada** para o
filtro funcionar. Ela substitui `dash_gestao_ultimates_roster(uuid)` por
`(uuid, date, date)` com defaults nulos.

Ordem da fila deste ambiente:

```
049 → 050 → 051 → 052 → 053 → 054 → 055 → 056 → 058
```

A `057` pertence ao branch `feat/ultimates-multi-produto` e é independente desta.

Depois de aplicar, confirme que sobrou **uma única** assinatura:

```sql
select p.oid::regprocedure
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'dash_gestao_ultimates_roster';
```

Esperado: exatamente `dash_gestao_ultimates_roster(uuid,date,date)`. **Duas linhas** significa
que o `drop function` não pegou — nesse caso a chamada sem parâmetros fica ambígua
("function is not unique") e o dashboard quebra até a versão de um argumento ser removida.

## Se o filtro aparecer como indisponível

A barra mostra `Recorte por data indisponível — migration pendente` quando a rota
`GET /api/ultimates/cycles/[id]/roster?start&end` responde **501**. Isso significa que o
PostgREST devolveu `PGRST202` — a RPC não existe com aquela assinatura.

Causas, em ordem de probabilidade:

1. A migration 058 não foi aplicada.
2. Foi aplicada, mas o cache de schema do PostgREST ainda não recarregou. Force com
   `notify pgrst, 'reload schema';` ou aguarde o refresh automático.
3. A migration foi aplicada fora de ordem e falhou (ela exige a 056 — o corpo referencia
   `dash_gestao_hotmart_sales.buyer_name`, coluna criada lá).

Enquanto isso, o dashboard **continua funcionando inteiro** com os números do ciclo: essa é
a degradação desenhada na decisão 7 do spec. Nenhum tile fica em branco ou zerado.

## Verificação manual pendente

Este ambiente tem a fila de migrations atrasada, então a validação com dados reais só é
possível depois do passo acima. Roteiro:

1. Sem filtro, os números batem com os de antes desta branch.
2. Intervalo cobrindo o ciclo inteiro não muda nenhum tile de movimento.
3. Intervalo estreito derruba Renovados e Novos Compradores; Base e a barra de meta **não**
   mudam; o aviso aparece no card 01.
4. Na granularidade **dia**, o topo da curva bate com o tile "Renovados" no mesmo intervalo.
   Na granularidade **hora** pode divergir na fronteira — a visão hora é a única em
   America/Sao_Paulo, divergência já documentada na decisão 3 do spec de evolução por hora.
5. Recarregar mantém o intervalo; "Limpar" o remove e ele não volta.

## Risco em aberto

**Reembolso sem `approved_date`.** O recorte filtra por `s.approved_date::date`, a mesma
expressão que a RPC `_daily` usa. Uma venda `REFUNDED` com `approved_date` nula cai fora de
qualquer intervalo, e o tile "Renovação reembolsada" subcontaria sob filtro.

Não há dado disponível para dizer se a Hotmart produz esse caso. **A verificar no passo 3
acima:** com um intervalo estreito que contenha um reembolso conhecido, o tile deve contá-lo.
Se não contar, a correção é filtrar reembolsos por outra coluna de data dentro da RPC — é
mudança de banco, não de UI.
