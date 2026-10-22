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

Alta `#3FBF9A` (7,1:1 sobre o casco), queda `#F0645A` (5,2:1) e ardósia `#4F6D86` (3,0:1) foram conferidas na #254. Alta e queda sempre vão com ícone e rótulo, nunca só a cor.

### Gráficos (validado na #254 com a skill `dataviz`, contra o casco `#0C2230`)

| Série | Hex | Uso |
|---|---|---|
| 1 | `#2E8BB9` | azul IGT |
| 2 | `#D95926` | laranja |
| 3 | `#199E70` | verde-água |
| 4 | `#9085E9` | violeta |
| 5 | `#D55181` | magenta |
| Outros | `#4F6D86` | ardósia: a sexta série e além viram "Outros", nunca uma cor nova |

Ordem fixa, nunca cíclica; a cor segue a entidade, não o ranking. Pior par adjacente: CVD 9,4 (meta 8) e visão normal 19,7 (piso 15); contraste mínimo 3:1. O âmbar fica de fora da paleta de séries de propósito: é só o último ponto de cada linha. O funil usa uma rampa de um tom azul (`#A9DDF3`, `#7FCBEB`, `#55B0DB`, `#2E8BB9`, `#216F97`), validada como ordinal.

## Tipografia

Uma família: **Manrope** (`next/font`, self-host). Números grandes em peso leve, tabelas em peso médio. Urbanist (a escolha inicial, de geometria mais próxima da logo) foi trocada porque não tem algarismos tabulares (sem a feature `tnum`, dígitos proporcionais); Manrope tem `tnum` e geometria parecida, e é o que importa em dashboard.

## Layout

Desktop: trilho de navegação à esquerda (recolhe) e grade de containers. Celular: barra de abas embaixo. Tudo alinhado à esquerda.

## Movimento e luz

- Movimento autônomo só no herói do Indicadores (único momento WebGL: feixe de luz azul descendo até o ponto âmbar).
- Resto anima em resposta ao uso: trocar filtro, abrir card, passar o mouse num ponto.
- Efeitos de luz vêm do azul claro (feixes, brilho nas bordas dos cards em foco). Sombra e profundidade em camadas de azul, sem cinza.

## Evitar

Rótulos em caixa-alta, fonte mono em rótulos de dado, setas "→" em botões, cards idênticos, fade-in em cada seção, bordas de 1px como única forma de separar.
