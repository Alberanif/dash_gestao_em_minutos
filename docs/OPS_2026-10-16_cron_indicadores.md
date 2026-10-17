# OPS: cron de Indicadores no cron-job.org

PRD #225, issues #226 a #230. Substitui o cron antigo da Railway (desligado).

## Ordem de deploy

1. Aplicar a migration `supabase/migrations/073_cron_locks.sql` no Supabase (tabela e RPCs de lock). Sem ela, `POST /api/cron/indicadores` responde 500 ("Falha ao adquirir lock").
2. Fazer o deploy do código (Railway).
3. Só então criar/ativar os jobs no cron-job.org.

## Pré-requisito

A env `CRON_SECRET` precisa estar definida na Railway. O mesmo valor vai no header dos jobs.

## Endpoint

`POST https://<dominio-da-railway>/api/cron/indicadores`

- Auth: header `Authorization: Bearer <CRON_SECRET>`.
- `window` (opcional, padrão `24h`): `24h` ou `3d`.
- `platforms` (opcional, padrão `hotmart,meta-ads`): subconjunto de `hotmart`, `meta-ads`.
- Respostas: `202 {accepted:true}` (coleta iniciada em background), `202 {skipped:"em andamento"}` (rodada anterior ainda com o lock; não é erro), `400` parâmetro inválido, `401` auth, `500` falha ao adquirir lock.
- O lock expira sozinho em 45 min se uma rodada morrer sem liberá-lo.
- O resultado por conta fica em `dash_gestao_cron_logs`.

## Jobs no cron-job.org

Crie dois jobs com a mesma configuração, mudando URL e agenda.

| Campo | Job 1 (24h) | Job 2 (3d) |
|-------|-------------|------------|
| Título | Indicadores 24h | Indicadores 3d |
| URL | `https://<dominio>/api/cron/indicadores?window=24h` | `https://<dominio>/api/cron/indicadores?window=3d` |
| Agenda | de hora em hora (minuto 0) | todo dia às 03:30 |
| Fuso | America/Sao_Paulo | America/Sao_Paulo |
| Método | POST | POST |

Em "Advanced":

- Headers: `Authorization` = `Bearer <CRON_SECRET>`.
- Request method: POST, sem corpo.
- Timeout: o cron-job.org corta a requisição em ~30s. A rota responde 202 logo após pegar o lock, então cabe no limite. **Confirmar o limite no painel** (Settings do job) e ajustar se o plano permitir outro valor.
- Notificações: ativar aviso por e-mail em falha (e opcionalmente ao se recuperar). Falha = resposta fora de 2xx; `202 skipped` conta como sucesso.

O job das 03:30 (`3d`) reprocessa os últimos 3 dias e captura confirmações tardias de PIX/boleto; o horário (`24h`) mantém os números do dia frescos. O noturno fica às 03:30, e não às 03:00, de propósito: se coincidisse com o job horário, o lock faria o segundo responder `skipped`, e podia ser justamente o de `3d` que fosse pulado. Se a rodada das 03:00 ainda estiver ativa às 03:30, o `3d` também é pulado; confira o log no dia seguinte.

## Teste manual

```bash
curl -i -X POST "https://<dominio>/api/cron/indicadores?window=24h" \
  -H "Authorization: Bearer $CRON_SECRET"
```

Esperado: `202` com `{"accepted":true,"window":"24h","platforms":["hotmart","meta-ads"]}`. Conferir depois as linhas novas em `dash_gestao_cron_logs`. Sem o header, deve responder 401.

## Fora do escopo: YouTube e Instagram

Hoje YouTube e Instagram **não têm coleta automática**. O endpoint só aceita `hotmart` e `meta-ads`. As rotas `*/batch-collect` (manuais, usadas pela tela Dados) e `hotmart/sync-products` (botão "Sincronizar Produtos") foram mantidas. Para voltar a coletar YouTube/Instagram automaticamente, é preciso estender `ALLOWED_PLATFORMS` em `src/app/api/cron/indicadores/route.ts` e criar um job novo.

## Rotas removidas (#230)

`/api/cron/collect`, `/api/cron/sync`, `/api/cron/hotmart/daily`, `/api/cron/hotmart/weekly`, `/api/cron/hotmart/products`, `/api/cron/youtube`, `/api/cron/instagram`. Se algum agendador externo ainda as chamar, passará a receber 404; desative-o.
