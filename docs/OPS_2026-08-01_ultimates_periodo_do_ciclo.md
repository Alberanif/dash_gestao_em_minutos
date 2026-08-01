# Dash Ultimates — período de visualização do ciclo

**Migration:** `063_ultimates_cycle_view_range.sql`
**Depende de:** `049` (tabela) e `058`/`061` (RPC do roster com recorte). Independente da `062`.
**Status:** implementado; **validação manual com dados reais pendente** (checklist abaixo)

---

## O que mudou

O filtro De/Até do dashboard deixou de ser preferência de quem olha e virou
**propriedade do ciclo**. Quem define é gestor; **todos** que abrem aquele ciclo
veem o mesmo recorte.

Ciclo sem período definido continua se comportando exatamente como antes: visão
geral de tudo que o produto tem.

| | Antes | Agora |
|---|---|---|
| Onde mora | `localStorage`, uma chave global por navegador | `cycles.view_start_date` / `view_end_date` |
| Escopo | por usuário, **vazava entre ciclos** (a chave não era por ciclo) | por ciclo, igual para todo mundo |
| Quem define | qualquer um, só para si | só gestor, para todos |

---

## Aplicar

```sql
-- supabase/migrations/063_ultimates_cycle_view_range.sql
alter table public.dash_gestao_ultimates_cycles
  add column if not exists view_start_date date,
  add column if not exists view_end_date   date;

alter table public.dash_gestao_ultimates_cycles
  drop constraint if exists chk_ultimates_cycle_view_range;

alter table public.dash_gestao_ultimates_cycles
  add constraint chk_ultimates_cycle_view_range check (
    (view_start_date is null) = (view_end_date is null)
    and (view_start_date is null or view_end_date >= view_start_date)
  );
```

(O arquivo tem os `comment on column` também — rode-o inteiro.)

**Nenhuma RPC muda.** `dash_gestao_ultimates_roster` já recebe
`(p_cycle_id, p_start, p_end)` desde a `058`. Esta migration só dá ao ciclo onde
guardar as duas datas que a API já sabia repassar.

**Nenhum backfill.** As colunas nascem nulas, e nulo é o comportamento atual.

---

## O que acontece se a `063` não subir

Nada quebra. O `GET /api/ultimates/cycles` faz `select *`, então as chaves
simplesmente não vêm na resposta, `viewRangeFrom` devolve `null`, e todo ciclo se
comporta como "sem período" — o dash de hoje. O gestor que tentar salvar recebe o
erro da barra e nada é gravado.

---

## As decisões que parecem bug

### 1. Base e meta continuam do ciclo inteiro, mesmo com período definido

Com período, o card 01 é **misto de propósito**: "Base" e a barra de meta são
estoque do ciclo; "Renovados", "Novos compradores" e a curva são movimento da
janela. É por isso que existe a nota `Base e meta seguem o ciclo inteiro` embaixo
do título — sem ela o card mentiria por omissão.

Foi decisão explícita não mudar isso junto: um ciclo com janela estreita passaria
a mostrar meta baixa sem estar atrasado.

### 2. A tabela esconde os "não renovados" quando há período

Não é filtro perdido. Dentro de uma janela, `nao_renovado` significa "não
movimentou **nesta** janela", e listar a base inteira como não renovada
esconderia justamente quem movimentou. A RPC continua devolvendo todo mundo — o
descarte é da exibição.

### 3. Gestor consegue mexer no período de ciclo ENCERRADO

Proposital, e diferente de upload/vínculo/refresh (que o encerramento bloqueia).
O período é lente de leitura — não altera nenhum dado —, e ciclo encerrado é
justamente o que se analisa em recorte depois. Mesmo racional das listas de
ofertas e leads excluídos.

### 4. Falha no recorte agora avisa em vermelho, antes caía calado

Quando o intervalo era escolha pessoal, cair para o ciclo inteiro em silêncio era
aceitável: quem tinha acabado de clicar via os números mudarem. Agora quem abre o
ciclo não pediu nada e não sabe qual janela deveria estar valendo — um fallback
mudo mostraria números **maiores** que o período define, sem ninguém perceber.

Por isso **qualquer** falha da chamada recortada (não só o 501 de migration
pendente) marca indisponível.

### 5. Salvar não é otimista

Diferente do switch "Novas Compras". A escrita muda o que todos veem, e aplicar
antes da confirmação dispararia a carga do roster recortado; se o PATCH
falhasse, o rollback dispararia outra, e o dash piscaria entre dois recortes —
um deles inexistente no banco.

### 6. Analista sem período não vê barra nenhuma

Não é bug de renderização. Dois campos de data vazios e desabilitados não
comunicam nada e convidam ao clique. Com período, ele vê o texto
`Período: 01/07/2026 – 15/07/2026 · definido pelo gestor`.

---

## Checklist de validação (com dados reais, depois de aplicar)

- [ ] Ciclo sem período: dash idêntico ao de antes; nenhuma chamada com `start=` no Network.
- [ ] Gestor define 01–15/07 e salva: KPIs de movimento, curva e tabela recortam; "Base" e meta **não**; a nota aparece.
- [ ] Recarregar a página mantém o período (agora vem do banco, não do navegador).
- [ ] **Outro usuário** (analista, outro navegador) abre o mesmo ciclo e vê o mesmo período, como texto, sem campos.
- [ ] Trocar de ciclo: o período do ciclo A **não** vaza para o ciclo B.
- [ ] Gestor clica "Limpar": volta ao ciclo inteiro para todos.
- [ ] Ciclo encerrado: gestor ainda consegue definir/alterar o período.
- [ ] Analista **não** consegue: `PATCH /api/ultimates/cycles/{id}` com `viewStartDate` responde 403.
- [ ] `{ "viewStartDate": "2026-07-01" }` sozinho responde 400 (`devem vir juntos`), sem gravar.
- [ ] Fim antes do início responde 400 e a barra mostra o erro sem salvar.
- [ ] O topo da curva bate com o tile de renovados no período (mesma fronteira `::date` da `daily`).
