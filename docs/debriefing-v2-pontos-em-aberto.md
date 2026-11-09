# Debriefing V2: respostas aos pontos em aberto do PRD #293

Cada bloco de issue acrescenta a sua seção. Edite só a sua.

## #295 (hook de dados e estados)

### Destino do botão "Configurar produto principal"

Resposta: link (`next/link`) para `/v2/indicadores/eventos`, a lista de eventos, onde existe o diálogo de edição
(`eventos-lista.tsx`, `modo="editar"`). Abrir o diálogo a partir da página do evento não é barato: o diálogo e o
estado de edição moram na lista, e trazê-los para a rota do evento aumentaria o chunk inicial (orçamento de 180 KB).
Follow-up possível: aceitar `?editar=<id>` na lista para abrir o diálogo já no evento certo.

### "Atualizar agora" alimenta as vendas do Debriefing?

Resposta: sim. O botão faz `POST /api/indicadores/refresh`, que roda `runRound(["hotmart", "meta-ads"], "24h")`.
A coleta Hotmart (`collectHotmart`, via `syncPlatform`) grava com upsert em `dash_gestao_hotmart_sales`, a mesma tabela
que `fetchDebriefingMetrics` lê. Ao terminar, o botão chama `queryClient.invalidateQueries()`, que também refaz a
consulta `["debriefing", ...]`. Portanto o botão continua visível na visão Debriefing (decisão 4 do PRD), sem mudança.
Limite: a janela da coleta é de 24 h, então vendas mais antigas só chegam pelo cron/webhook.

### Decisão de chave de consulta

A chave é `["debriefing", start, end, produtos]`, com `produtos` = produtos principais do evento (o que vai em
`products` na API). A seleção dos chips (#296) recorta o resultado no cliente com `selectDebriefingProducts`, como na
V1, então trocar de chip não refaz a consulta. O hook não tem retry automático: o erro aparece e "Tentar de novo" refaz.
