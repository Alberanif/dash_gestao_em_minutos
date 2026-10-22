# Direção de design — Dash V2

**Aprovada em:** 2026-10-22 · **Owner:** Alberani · **PRD:** #250

## Conceito: "o ponto"

A logo IGT termina num ponto âmbar. Na V2 o tema escuro é azul IGT em profundidade, e o âmbar aparece só onde há dado vivo: o último ponto de cada linha, o dia de hoje, a seleção ativa e o número principal do herói.

Regra dura: o âmbar nunca vira botão, borda decorativa ou degradê.

## Paleta

Valores em `tokens.css` (mesma pasta). Cores da marca extraídas dos pixels de `IGT.png`: azul `#2E8BB9`, ponto `#FBAC00`.

| Nome | Hex | Uso |
|---|---|---|
| Abismo | `#06141D` | fundo da página |
| Casco | `#0C2230` | cards e superfícies |
| Casco alto | `#123246` | elevados, hover |
| Azul IGT | `#2E8BB9` | primária, séries, links |
| Azul luz | `#6EC3EA` | feixes de luz, realces, texto pequeno |
| Ponto | `#FBAC00` | só o dado vivo e o foco do momento |
| Névoa | `#E8F3F9` | texto principal |

Alta `#3FBF9A`, queda `#F0645A` e ardósia `#4F6D86` são provisórias até a validação de `dataviz` na #254.

## Tipografia

Uma família: **Urbanist** (`next/font`, self-host). Geometria próxima da logo. Números grandes em peso leve, tabelas em peso médio. Pendente confirmar algarismos tabulares; plano B Manrope.

## Layout

Desktop: trilho de navegação à esquerda (recolhe) e grade de containers. Celular: barra de abas embaixo. Tudo alinhado à esquerda.

## Movimento e luz

- Movimento autônomo só no herói do Indicadores (único momento WebGL: feixe de luz azul descendo até o ponto âmbar).
- Resto anima em resposta ao uso: trocar filtro, abrir card, passar o mouse num ponto.
- Efeitos de luz vêm do azul claro (feixes, brilho nas bordas dos cards em foco). Sombra e profundidade em camadas de azul, sem cinza.

## Evitar

Rótulos em caixa-alta, fonte mono em rótulos de dado, setas "→" em botões, cards idênticos, fade-in em cada seção, bordas de 1px como única forma de separar.
