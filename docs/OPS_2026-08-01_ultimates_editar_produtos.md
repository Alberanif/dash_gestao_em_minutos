# Dash Ultimates — editar os produtos de um ciclo

**Migration:** `062_ultimates_edit_cycle_products.sql`
**Depende de:** `061` aplicada e validada (PR anterior)
**Status:** implementado; **validação manual com dados reais pendente** (checklist abaixo)

---

## O que mudou

O conjunto de produtos de um ciclo deixou de ser definido só na criação. No modal
de edição, o gestor agora **adiciona e remove** produtos — com o mesmo bloco de
busca + seleção múltipla da criação, já preenchido com o conjunto atual.

**Só em ciclo ativo.** Ciclo encerrado mostra os produtos como texto e explica
que é preciso reativá-lo. A regra é repetida no banco: a RPC levanta exceção.

---

## A parte que não é óbvia: o que acontece ao REMOVER

Três coisas ficam para trás quando um produto sai, e elas recebem tratamento
diferente **de propósito**.

### Vínculos manuais e ofertas excluídas: preservados

Ficam inertes. As RPCs de leitura só olham as vendas dos produtos do ciclo, então
uma oferta excluída de produto que saiu não filtra nada. Ninguém apaga essas
linhas — **readicionar o produto devolve a configuração inteira**, com a nota que
o gestor escreveu. Apagá-las destruiria trabalho para resolver um problema que
não existe.

### Compradores materializados: apagados, com duas condições

Só existe em ciclo **Apenas Compras**, onde o roster é preenchido por
`sync_buyers_from_sales`. Essa RPC é aditiva por contrato (nunca apaga), então
sem tratamento os compradores do produto removido ficariam no roster **sem venda
nenhuma, contando nos KPIs**.

A linha é apagada se — e só se — as duas forem verdadeiras:

1. **foi materializada** (`from_sales = true`), nunca uma linha que o gestor
   subiu ou cadastrou;
2. **não tem mais nenhuma venda contável** nos produtos que sobraram.

A segunda condição é o que protege quem comprou em dois produtos do ciclo: sai um
produto, a pessoa continua valendo pelo outro e permanece no roster.

> **Por que não `source_product_id`.** Gravar "qual produto materializou a linha"
> parece mais informativo e está errado: o INSERT é por **email**, não por venda.
> Quem compra em dois produtos vira UMA linha, e o produto gravado seria só o
> primeiro que a sync viu — remover esse produto apagaria alguém que ainda tem
> compra no outro, em silêncio. A coluna responde "é do gestor ou da máquina?",
> que é binária; "ainda tem venda?" é pergunta de runtime.

O vínculo manual de um comprador apagado vai junto (`on delete cascade` em
`buyer_id`) — ele apontava para uma linha que não existe mais.

---

## O que acontece ao ADICIONAR

A troca **não dispara refresh**. Ela roda `sync_buyers_from_sales` a partir das
vendas **já coletadas**, sem tocar na Hotmart.

Isso é deliberado: o refresh é o caminho mais frágil do módulo (lock, deadline de
45s, histórico de 409 por lock órfão) e nunca foi validado neste ambiente.
Amarrar a edição de um ciclo a ele faria salvar um produto poder demorar um
minuto ou falhar.

**Consequência operacional:** o que ainda não foi coletado entra no próximo
"Atualizar agora". A tela avisa isso no recibo.

---

## Onde a contagem aparece

Depois de salvar, a tela mostra um recibo dispensável com quantos produtos
entraram e saíram, quantos compradores saíram do roster e quantos entraram.

Fica na tela e **não no modal**, porque quando a contagem existe o modal já
fechou. É o único registro de quantas linhas foram apagadas — o gestor não teria
como contá-las depois.

---

## Checklist de validação manual

Como sempre neste módulo: a suíte roda com o Supabase mockado, então **nem a RPC
de troca nem a sync são exercitadas por teste**.

### 1. Ciclo Apenas Compras — o caso que motiva a feature

1. Num ciclo `purchases_only` com um produto, anote o total de linhas do roster.
2. **Adicione** um segundo produto que tenha vendas já coletadas. Salvar deve
   trazer compradores novos, e o recibo deve informar quantos.
3. Edite à mão o nome de **um** desses compradores novos.
4. **Remova** o segundo produto. Confirme no segundo clique.
5. Espere: as linhas trazidas por ele somem, **exceto** quem também tinha compra
   no primeiro produto. O total volta ao do passo 1.
6. Readicione o segundo produto. As linhas voltam — e o nome que você editou à
   mão **tem que voltar como você deixou**, não como veio da Hotmart. Se voltar
   o nome da Hotmart, o `ON CONFLICT DO NOTHING` foi quebrado em algum lugar.

### 2. Comprador que não pode sumir

Num ciclo com dois produtos, encontre um email com compra **nos dois**. Remova um
produto. Ele **tem que continuar no roster**, com `total_value` reduzido ao que
sobrou. Se sumir, a segunda condição da regra de remoção não está sendo aplicada.

### 3. Linha do gestor nunca é apagada

Em ciclo de renovação (não `purchases_only`), suba a base, adicione e remova um
produto. **Nenhuma linha de roster pode sumir** — todas vieram do upload
(`from_sales = false`).

### 4. Configuração preservada

Antes de remover um produto, exclua uma oferta dele com uma nota. Remova o
produto, readicione. A oferta excluída **e a nota** têm que continuar lá.

### 5. Recusas

- Desmarcar todos os produtos e salvar → erro na tela, sem PATCH.
- Ciclo encerrado → produtos aparecem como texto, sem seleção.
- Produto de outra conta Hotmart → botão desabilitado, com motivo no `title`.

---

## Rollback

O bloco `DOWN` está no rodapé da `062`. Sem perda de dado de comprador — a coluna
só classifica linhas que já existiam.

O que **não volta** é o que a edição já apagou: compradores materializados
removidos junto com um produto não são recuperáveis por rollback. Eles voltam
pela materialização se o produto for readicionado e a venda ainda existir.
