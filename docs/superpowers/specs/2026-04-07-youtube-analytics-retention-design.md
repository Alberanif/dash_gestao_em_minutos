# YouTube Analytics — Métricas de Retenção (Proxy)

**Data:** 2026-04-07  
**Status:** Aprovado

## Contexto

O dashboard do YouTube exibe atualmente apenas métricas de canal (inscritos, views totais, contagem de vídeos) e uma tabela de vídeos com likes e comentários brutos. Não há nenhuma métrica de performance relativa (engajamento, retenção) como KPI de destaque.

O objetivo é adicionar indicadores de retenção calculados a partir dos dados já coletados via YouTube Data API v3, sem necessidade de integrar a YouTube Analytics API. A abordagem proxy usa likes/views como sinal principal de retenção, complementado por métricas de engajamento total e taxa de comentários.

## Métricas

| KPI | Fórmula | Exibição |
|-----|---------|----------|
| Retenção (principal) | `mean(like_count / view_count)` por vídeo | Percentual, ex: `4.2%` |
| Engajamento Total | `mean((like_count + comment_count) / view_count)` por vídeo | Percentual, ex: `4.8%` |
| Taxa de Comentários | `mean(comment_count / view_count)` por vídeo | Percentual, ex: `0.6%` |
| Duração Média | `mean(duration_em_segundos)` dos vídeos | Formato `mm:ss`, ex: `8:34` |

**Regra de exclusão:** Vídeos com `view_count = 0` são excluídos do cálculo das médias para evitar divisão por zero.

## Arquitetura

Nenhuma mudança de API, banco de dados ou cron. Todos os cálculos são feitos **client-side** em `src/app/dashboard/youtube/page.tsx` após o fetch de `/api/youtube/videos`.

```
fetch /api/youtube/videos
        ↓
[VideoSnapshot[]]
        ↓
calcRetentionMetrics(videos) → { retencao, engajamento, taxaComentarios, duracaoMedia }
        ↓
Renderiza KPI cards + tabela atualizada
```

## Layout

### Aba "Visão Geral"

**Linha 1 — Métricas de canal** (3 cards, existentes):
- Inscritos
- Views Totais  
- Total de Vídeos

**Linha 2 — Métricas de performance** (4 cards, novos):
- Retenção (likes/views %)
- Engajamento Total ((likes+comments)/views %)
- Taxa de Comentários (comments/views %)
- Duração Média (mm:ss)

**Gráfico:** Evolução do Canal (existente, sem alteração)

### Aba "Vídeos" — Tabela

Colunas atualizadas:

| Coluna | Tipo | Observação |
|--------|------|-----------|
| Título | thumbnail + texto | existente |
| Views | número | existente |
| Retenção | likes/views % | substitui coluna "Likes" |
| Engajamento | (likes+comments)/views % | substitui coluna "Engagement" atual |
| Comentários/Views | comments/views % | substitui coluna "Comments" |
| Duração | mm:ss | existente |
| Publicado | data | existente |

Os valores absolutos de likes e comments são removidos das colunas visíveis. Métricas absolutas podem ser acessadas via CSV export (mantido).

## Arquivos a Modificar

- `src/app/dashboard/youtube/page.tsx` — único arquivo alterado:
  - Adicionar função `calcRetentionMetrics(videos)` 
  - Adicionar segunda linha de KPI cards (4 cards)
  - Atualizar definição de colunas da DataTable

## Componentes Reutilizados

- `KpiCard` (`src/components/ui/kpi-card.tsx`) — usado para os 4 novos cards, sem alteração no componente
- `DataTable` (`src/components/ui/data-table.tsx`) — reconfigurada com novas colunas, sem alteração no componente

## Verificação

1. Selecionar uma conta YouTube com vídeos coletados
2. Confirmar que os 4 novos KPI cards aparecem na aba "Visão Geral"
3. Confirmar que Retenção exibe percentual (não NaN nem Infinity)
4. Confirmar que vídeos com 0 views não distorcem a média
5. Confirmar que a tabela de vídeos exibe as 3 métricas percentuais corretamente
6. Exportar CSV e confirmar que os dados estão presentes
