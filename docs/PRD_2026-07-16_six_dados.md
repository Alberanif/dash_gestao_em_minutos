# PRD — Six Dados: resumos de IA dos Eventos ativos

**Date:** 2026-07-16
**Status:** Approved (decisões validadas em entrevista com o owner)
**Owner:** Alberani

## 1. Contexto e problema

A tela de Eventos (`/indicadores/eventos`) é a entrada do módulo Indicadores e lista todos os Eventos (filtros salvos em `dash_gestao_filters`), agrupados por status. Os cards mostram métricas vitalícias (leads, investimento, CPL), mas números soltos não contam a história: para saber *como está indo* cada lançamento ativo, o gestor precisa abrir o dashboard de cada Evento, um por um, e interpretar os cards.

O app já possui um agente de IA ("Analista", em `src/lib/agent/`) que responde perguntas sobre os dados de um Evento — porém apenas em modo chat interativo, um Evento por vez, sob demanda do usuário.

**Objetivo:** oferecer, no topo da tela de Eventos, um carrossel de cards — um por Evento **ativo** — em que a IA gera um "storytelling" curto dos principais KPIs e resultados daquele Evento, atualizado no máximo a cada hora. Visão executiva de todos os lançamentos ativos em um só lugar, sem abrir dashboard nenhum.

## 2. Escopo

### Incluído (v1)

- Seção **"Six Dados"** no topo de `/indicadores/eventos`, acima das pastas de Eventos.
- Um card por Evento com `status = 'ativo'`, em carrossel com rotação automática a cada **30 segundos** e navegação manual (dots + setas).
- Cada card exibe: nome do Evento, **KPIs em destaque renderizados pela UI** a partir de snapshot confiável do banco (nunca do texto do LLM), narrativa curta (3–5 frases) gerada por IA, e "Atualizado há X min".
- Relatórios gerados **sob demanda com cache de 1 hora** (sem cron): quem abre a tela vê o cache; relatórios vencidos regeneram individualmente com skeleton.
- Dados cobertos por relatório: **vitalício** (desde `LIFETIME_START`) + **últimos 7 dias** (tendência).
- Geração via **chamada one-shot** ao mesmo modelo do agente (`getAgentModel()` / env `AGENT_MODEL`), com os números prontos no prompt.

### Fora de escopo (v1)

| Item | Motivo |
|---|---|
| Cron / geração agendada | Decisão do owner: sob demanda com cache de 1h tem o mesmo efeito prático, sem depender de agendador externo (não existe agendador no repo) |
| Alterações no agente de chat existente | A feature só reutiliza a camada de serviço e as convenções de prompt; `graph.ts`, `tools.ts` e o endpoint SSE ficam intocados |
| Histórico de relatórios | Tabela guarda apenas o relatório vigente por Evento (upsert); histórico é evolução futura |
| Cards para Eventos finalizados/cancelados | Six Dados cobre somente `status = 'ativo'` |
| Regeneração manual ("gerar agora") | v1 respeita apenas o TTL de 1h; botão de refresh é evolução futura |
| Modelo dedicado/mais barato | Decisão do owner: mesmo modelo do agente, uma só configuração de IA no app |

## 3. Experiência do usuário

### 3.1 Posição e estados da seção

1. A seção Six Dados aparece no topo de `/indicadores/eventos`, antes das pastas de status.
2. **0 Eventos ativos:** a seção não é renderizada.
3. **1 Evento ativo:** card fixo, sem rotação, sem dots/setas.
4. **2+ Eventos ativos:** carrossel com rotação automática a cada 30s.
5. A visibilidade segue a da própria tela de Eventos — nenhuma regra de role nova.

### 3.2 Carrossel

- Rotação automática: troca de card a cada **30 segundos**, em loop.
- **Dots** (um por Evento ativo) clicáveis e **setas** anterior/próximo.
- **Hover pausa** a rotação; sair do hover retoma.
- Interação manual (dot/seta) reinicia o timer de 30s a partir daquele card.
- Ordem dos cards: mesma ordenação dos Eventos ativos na tela (consistência com as pastas).

### 3.3 Anatomia do card

```
┌────────────────────────────────────┐
│ 📊 <Nome do Evento>          ●○○  │
│                                    │
│  ROAS      Receita    Leads   CPL  │
│  3.2x      R$ 48.2k   1.840   R$9  │
│                                    │
│  <Narrativa da IA: 3–5 frases      │
│  contextualizando totais e         │
│  tendência dos últimos 7 dias>     │
│                                    │
│  Atualizado há 40 min              │
└────────────────────────────────────┘
```

- **Linha de KPIs** (vitalícios): ROAS, Receita BRL, Leads captados, CPL — renderizados pela UI **direto do `kpi_snapshot`** salvo no banco. O texto da IA pode citar números, mas os KPIs "oficiais" do card nunca passam pelo modelo.
- **Narrativa:** parágrafo curto em pt-BR gerado pelo LLM; contextualiza o acumulado do Evento e a direção da última semana (aceleração/queda de captação, CPL, vendas). Sem markdown pesado — texto corrido, no máximo negritos.
- **Rodapé:** "Atualizado há X min", calculado de `generated_at`.
- Formatação de números idêntica aos formatters existentes do módulo (moeda `pt-BR` BRL, `—` para indisponível — nunca `0` enganoso).

### 3.4 Estados de carregamento e erro

- **Cache válido (< 1h):** card renderiza imediatamente.
- **Cache vencido ou inexistente:** o card correspondente mostra **skeleton** (KPIs podem aparecer antes, se houver snapshot anterior) enquanto a geração individual roda; preenche ao concluir. Os demais cards não esperam.
- **Falha na geração:** se existe relatório anterior, exibi-lo com aviso discreto de desatualizado; se não existe, o card mostra estado de erro leve ("resumo indisponível") sem quebrar o carrossel.
- A rotação de 30s não espera geração: cards em skeleton participam do ciclo normalmente.

## 4. Requisitos funcionais

- **RF-1** — A seção exibe exatamente um card por Evento com `status = 'ativo'`; 0 ativos ⇒ seção oculta; 1 ativo ⇒ card fixo sem controles.
- **RF-2** — Rotação automática a cada 30s com dots + setas; hover pausa; interação manual reinicia o timer.
- **RF-3** — Um relatório é considerado **vencido** quando `generated_at` tem mais de 1 hora **ou** quando o filtro foi editado depois da geração (`filters.updated_at > generated_at`).
- **RF-4** — Relatório vencido/inexistente é regenerado sob demanda, **individualmente por Evento** (uma request por Evento), sem bloquear a renderização dos demais.
- **RF-5** — Gerações concorrentes do mesmo Evento (dois usuários abrindo a tela ao mesmo tempo) não podem produzir chamadas duplicadas ao LLM — a segunda request reaproveita/espera a geração em andamento (lock).
- **RF-6** — Os KPIs em destaque do card vêm do `kpi_snapshot` persistido (mesma consulta que alimentou o prompt), nunca extraídos do texto gerado.
- **RF-7** — A narrativa segue as REGRAS DURAS do agente: só números fornecidos, nunca estimar, `null` = indisponível (não zero), pt-BR, timezone America/Sao_Paulo.
- **RF-8** — Evento que sai de `status = 'ativo'` desaparece do carrossel na próxima carga da tela; excluir o filtro remove o relatório (FK cascade).

## 5. Requisitos técnicos

### 5.1 Persistência — nova tabela `dash_gestao_ai_reports`

Migration nova (numeração sequencial após a última existente), seguindo o padrão de RLS do projeto (leitura `authenticated`, escrita via `service_role`):

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid pk | `gen_random_uuid()` |
| `filter_id` | uuid **unique**, fk → `dash_gestao_filters(id) on delete cascade` | um relatório vigente por Evento (upsert) |
| `report_text` | text | narrativa gerada |
| `kpi_snapshot` | jsonb | números usados no prompt: bloco vitalício + bloco 7d (fonte dos KPIs da UI) |
| `generated_at` | timestamptz | fim da geração bem-sucedida |
| `generating_at` | timestamptz null | lock de concorrência; considerado expirado após ~2 min (geração travada) |
| `created_at` / `updated_at` | timestamptz | padrão do projeto |

### 5.2 Geração (novo módulo, agente intocado)

- Novo módulo em `src/lib/agent/six-dados/` (ou `src/lib/six-dados/`): `report.ts` (orquestração) + `prompt.ts` (prompt dedicado).
- Fluxo por Evento: carregar filtro → `expandFilter` → buscar **2 períodos** pela camada de serviço existente (`src/lib/indicadores/service/period-summary.ts`): vitalício (`LIFETIME_START` → hoje) e últimos 7 dias → montar prompt com os números prontos → **uma** chamada `model.invoke()` (sem tools, sem LangGraph, sem streaming) → upsert em `dash_gestao_ai_reports`.
- Prompt dedicado reaproveitando as convenções de `src/lib/agent/prompt.ts` (REGRAS DURAS, pt-BR, `null` ≠ 0), instruindo: 3–5 frases, tom executivo, destacar acumulado + tendência 7d, sem inventar números.
- Modelo: `getAgentModel()` de `src/lib/agent/model.ts` (default `gpt-4.1`, env `AGENT_MODEL`).
- Timeout defensivo por geração (ex.: 30s) e `max_tokens` limitado — é um parágrafo, não um relatório longo.

### 5.3 APIs

| Endpoint | Método | Comportamento |
|---|---|---|
| `/api/indicadores/six-dados` | GET | Autentica (`validateApiAuth`), lista Eventos ativos + relatório de cada um (texto, snapshot, `generated_at`, flag `stale` calculada pela regra RF-3). Nunca gera — resposta imediata. |
| `/api/indicadores/six-dados/generate` | POST `{filterId}` | Autentica; valida que o filtro existe e está ativo; se relatório ainda válido, devolve o existente (idempotente); se vencido, adquire o lock `generating_at` (update condicional — o perdedor da corrida aguarda/poll e devolve o resultado do vencedor), gera, faz upsert e devolve o relatório novo. |

- O cliente chama o GET ao montar a tela e dispara um POST por Evento com `stale: true`, em paralelo — cada POST é uma invocação serverless independente (sem timeout acumulado).

### 5.4 Frontend

- Novo componente `src/components/indicadores/six-dados-carousel.tsx` (+ card e skeleton), renderizado por `src/app/indicadores/eventos/page.tsx` acima das pastas.
- Timer de rotação com `setInterval` limpo no unmount; pausa por hover via estado; respeitar `prefers-reduced-motion` (sem animação de slide, troca seca).
- Hook de dados (ex.: `use-six-dados.ts`) encapsulando GET + POSTs progressivos e substituição dos cards conforme chegam.
- Antes de codificar, ler os guias em `node_modules/next/dist/docs/` (convenção do projeto — esta versão do Next.js tem breaking changes).

## 6. Critérios de aceite

1. Com 3 Eventos ativos, a tela exibe 3 cards que se alternam a cada 30s; dots e setas navegam manualmente; hover pausa a rotação.
2. Com 1 Evento ativo, o card aparece fixo, sem dots/setas; com 0, a seção não existe no DOM.
3. Primeira visita (sem cache): cards aparecem em skeleton e preenchem individualmente conforme cada geração conclui; nenhuma request única gera todos os relatórios.
4. Segunda visita dentro de 1h: todos os cards renderizam instantaneamente do cache, sem nenhuma chamada ao LLM (verificável por ausência de POST `/generate`).
5. Visita após 1h: apenas os relatórios vencidos regeneram; os demais vêm do cache.
6. Dois clientes abrindo a tela simultaneamente com cache vencido produzem **uma** única chamada ao LLM por Evento (lock de `generating_at`).
7. Os KPIs do card batem com os valores da camada de serviço para o mesmo Evento (vitalício), independentemente do texto gerado.
8. Editar um filtro (ex.: trocar produtos Hotmart) invalida o relatório: na próxima visita o card daquele Evento regenera.
9. Evento movido para `finalizado` some do carrossel na próxima carga; excluir o Evento remove a linha de `dash_gestao_ai_reports`.
10. Falha de geração (ex.: OPENAI_API_KEY inválida) não quebra a tela: card mostra estado de erro/desatualizado e o restante do carrossel funciona.

## 7. Riscos e pontos de atenção

- **Custo de LLM controlado por uso:** o teto é ~24 gerações/dia por Evento, e só nas horas em que alguém abre a tela. Sem cron, madrugada não gasta token.
- **Alucinação de números:** mitigada por arquitetura — KPIs exibidos vêm do snapshot, não do texto; o prompt herda as REGRAS DURAS. Ainda assim o texto pode citar números; o prompt deve instruir a citar apenas os fornecidos.
- **Lock de concorrência:** o update condicional de `generating_at` precisa ser atômico (uma statement) para funcionar entre invocações serverless; lock expirado (~2 min) deve ser roubável para geração travada não bloquear o Evento para sempre.
- **Latência da consulta vitalícia:** `period-summary` desde 2020 por Evento roda a cada geração (máx. 1×/h por Evento). O `eventos-metrics.ts` já faz consultas vitalícias parecidas com batching — mesmo perfil de carga; observar se a conta com "dezenas de filtros" citada no código sofrer.
- **Serverless:** cada geração é uma invocação própria (~5–20s), longe do limite; o padrão progressivo evita a request única de 30–60s que estouraria timeout.
- **Ambiguidade de "evento":** no código, "Evento" = filtro salvo (`FilterRecord`); não confundir com `captacao_leads_eventos` (eventos de captação dentro do filtro) nem com o módulo `eqa-eventos`.

## 8. Decisões registradas (entrevista de 2026-07-16)

| # | Decisão | Escolha |
|---|---|---|
| 1 | Estratégia de atualização | Sob demanda com cache de 1h — sem cron, sem agendador externo |
| 2 | Localização | Topo de `/indicadores/eventos`, acima das pastas de Eventos |
| 3 | Período dos dados | Vitalício + últimos 7 dias (tendência) |
| 4 | Arquitetura de geração | One-shot com números prontos no prompt; sem ReAct/tools/SSE; agente de chat intocado |
| 5 | Persistência | Nova tabela `dash_gestao_ai_reports`, upsert por `filter_id`, com snapshot jsonb |
| 6 | UX de cache vencido | Progressivo por Evento: cache instantâneo + regeneração individual com skeleton |
| 7 | Carrossel | Auto-rotação 30s + dots/setas; hover pausa; 1 ativo = fixo; 0 = oculto |
| 8 | Modelo | O mesmo do agente (`getAgentModel()` / `gpt-4.1` via `AGENT_MODEL`) |
| 9 | Formato do card | KPIs renderizados pela UI a partir do snapshot + narrativa curta do LLM |
