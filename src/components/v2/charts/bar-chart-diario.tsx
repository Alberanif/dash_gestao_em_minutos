"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { cx, foco } from "../ui/cx";
import { caminhoBarra, cleanPoints, formatarCompacto, formatarDataCurta, formatarDataLonga, yDomain, type XValue } from "./geometry";
import { COR } from "./palette";
import { GradienteBarra } from "./bar-chart";
import { escalaLinear } from "./scales";
import { CamadaAnimada, EstadoVazio, TabelaDados, TooltipGrafico } from "./parts";
import { useItemAtivo, useLarguraMedida } from "./use-chart";

export type BarChartDiarioProps = {
  titulo: string;
  /** Um ponto por dia. `x` é a data. */
  data: ReadonlyArray<{ x: XValue; y: number }>;
  /** Cor das barras (token CSS). */
  cor: string;
  altura?: number;
  formatarY?: (n: number) => string;
  animKey?: string;
  className?: string;
};

const MARGEM = { topo: 16, base: 28 };
const SLOT_MIN = 20; // abaixo disto por barra o gráfico para de encolher e passa a rolar
const SLOT_FIXO = 24;
const ESPESSURA_MAX = 24;
const RAIO = 4;
const MINI_H = 36;
const LARG_CHAR = 6.6;
const ESPACO_ROTULO_X = 52;

/**
 * Barras por dia. Cabendo na largura, as barras dividem o espaço; passando disso elas ficam com
 * largura fixa e o gráfico rola de lado (arrastar, tocar, setas), abrindo no dia mais recente.
 * O eixo do valor fica parado e a escala cobre o período inteiro, então a altura das barras não
 * muda enquanto se rola. Uma miniatura do período todo mostra onde a janela está e também arrasta.
 */
export function BarChartDiario({ titulo, data, cor, altura = 240, formatarY = formatarCompacto, animKey, className }: BarChartDiarioProps) {
  const { ref, largura } = useLarguraMedida<HTMLDivElement>();
  const pontos = useMemo(() => cleanPoints(data), [data]);
  return (
    <div ref={ref} className={className}>
      {pontos.length === 0 ? (
        <EstadoVazio titulo="Sem dados no período" dica="Ajuste o período ou os filtros." altura={altura} />
      ) : largura > 0 ? (
        <DiarioInterno
          titulo={titulo}
          pontos={pontos}
          largura={largura}
          altura={altura}
          cor={cor}
          formatarY={formatarY}
          animKey={animKey ?? pontos.map((p) => `${p.x}:${p.y}`).join("|")}
        />
      ) : (
        <div style={{ height: altura }} />
      )}
    </div>
  );
}

type Rolagem = { esq: number; vista: number; total: number };

function DiarioInterno({
  titulo,
  pontos,
  largura,
  altura,
  cor,
  formatarY,
  animKey,
}: {
  titulo: string;
  pontos: ReadonlyArray<{ x: number; y: number }>;
  largura: number;
  altura: number;
  cor: string;
  formatarY: (n: number) => string;
  animKey: string;
}) {
  const n = pontos.length;
  const { ativo, setAtivo, handlers } = useItemAtivo(n);
  const idGrad = `v2-barra-${useId().replace(/:/g, "")}`;
  const vpRef = useRef<HTMLDivElement>(null);
  const [rolagem, setRolagem] = useState<Rolagem>({ esq: 0, vista: 0, total: 0 });

  const areaH = Math.max(0, altura - MARGEM.topo - MARGEM.base);
  const { yEsc, ticks, esq, fy } = useMemo(() => {
    const y = escalaLinear(yDomain(pontos.map((p) => p.y)), [areaH, 0], { nice: true });
    const t = y.ticks(4);
    const medir = (f: (v: number) => string) => Math.max(...t.map((v) => f(v).length));
    let f = formatarY;
    let maior = medir(f);
    // Rótulo longo (moeda com centavos) comeria o gráfico no celular: cai para a forma compacta.
    if (maior * LARG_CHAR + 14 > largura * 0.3) {
      f = formatarCompacto;
      maior = medir(f);
    }
    return { yEsc: y, ticks: t, esq: Math.max(36, Math.min(Math.ceil(maior * LARG_CHAR) + 14, largura * 0.34)), fy: f };
  }, [pontos, areaH, formatarY, largura]);

  const vistaW = Math.max(0, largura - esq);
  const cabe = n * SLOT_MIN <= vistaW;
  const slot = cabe ? vistaW / n : SLOT_FIXO;
  const total = cabe ? vistaW : n * slot;
  const espessura = Math.max(3, Math.min(slot * 0.65, ESPESSURA_MAX));
  const zero = yEsc(0);
  const passoEscalona = Math.min(1, 10 / n);
  const saltoRotulos = Math.max(1, Math.ceil(ESPACO_ROTULO_X / slot));

  const atualizar = useCallback(() => {
    const el = vpRef.current;
    if (!el) return;
    const novo = { esq: Math.round(el.scrollLeft), vista: el.clientWidth, total: el.scrollWidth };
    setRolagem((r) => (r.esq === novo.esq && r.vista === novo.vista && r.total === novo.total ? r : novo));
  }, []);

  // Dado novo (período, filtro) volta para o dia mais recente.
  useLayoutEffect(() => {
    const el = vpRef.current;
    if (!el) return;
    el.scrollLeft = el.scrollWidth;
    atualizar();
  }, [animKey, cabe, atualizar]);

  // Seta do teclado leva a barra ativa para dentro da janela; o mouse passando por cima não rola nada.
  const porTeclado = useRef(false);
  useEffect(() => {
    if (!porTeclado.current) return;
    porTeclado.current = false;
    const el = vpRef.current;
    if (ativo === null || !el || cabe) return;
    const ini = ativo * slot;
    if (ini < el.scrollLeft) el.scrollLeft = Math.max(0, ini - slot);
    else if (ini + slot > el.scrollLeft + el.clientWidth) el.scrollLeft = ini + 2 * slot - el.clientWidth;
  }, [ativo, slot, cabe]);

  function aoTeclar(e: React.KeyboardEvent) {
    porTeclado.current = true;
    handlers.onKeyDown(e);
  }

  // Arrastar com o mouse (toque e trackpad já rolam sozinhos).
  const arrasto = useRef<{ x: number; esq: number; moveu: boolean } | null>(null);
  function aoApertar(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "mouse" || e.button !== 0 || cabe) return;
    arrasto.current = { x: e.clientX, esq: e.currentTarget.scrollLeft, moveu: false };
  }
  function aoMover(e: React.PointerEvent<HTMLDivElement>) {
    const a = arrasto.current;
    if (!a) return;
    const dx = e.clientX - a.x;
    if (!a.moveu) {
      if (Math.abs(dx) < 4) return;
      a.moveu = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      setAtivo(null);
    }
    e.currentTarget.scrollLeft = a.esq - dx;
  }
  function aoSoltar(e: React.PointerEvent<HTMLDivElement>) {
    if (arrasto.current?.moveu && e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    arrasto.current = null;
  }

  // Miniatura: a janela segue o ponteiro; apertar fora dela centraliza a janela ali.
  const mini = useRef<{ desvio: number } | null>(null);
  const irPara = (px: number, desvio: number) => {
    const el = vpRef.current;
    if (el && vistaW > 0) el.scrollLeft = ((px - desvio) / vistaW) * total;
  };
  const pxDaMini = (e: React.PointerEvent<SVGSVGElement>) => e.clientX - e.currentTarget.getBoundingClientRect().left;
  function miniApertar(e: React.PointerEvent<SVGSVGElement>) {
    if (rolagem.total === 0) return;
    const px = pxDaMini(e);
    const janelaX = (rolagem.esq / rolagem.total) * vistaW;
    const janelaW = (rolagem.vista / rolagem.total) * vistaW;
    const desvio = px >= janelaX && px <= janelaX + janelaW ? px - janelaX : janelaW / 2;
    mini.current = { desvio };
    e.currentTarget.setPointerCapture(e.pointerId);
    irPara(px, desvio);
  }
  function miniMover(e: React.PointerEvent<SVGSVGElement>) {
    if (mini.current) irPara(pxDaMini(e), mini.current.desvio);
  }
  const miniSoltar = () => {
    mini.current = null;
  };

  const b = ativo !== null ? pontos[ativo] : null;
  const bTopo = b ? Math.min(zero, yEsc(b.y)) : 0;
  const ativoX = ativo !== null ? ativo * slot + slot / 2 : 0;

  const primeiro = cabe || rolagem.total === 0 ? 0 : Math.min(n - 1, Math.floor(rolagem.esq / slot));
  const ultimo = cabe || rolagem.total === 0 ? n - 1 : Math.min(n - 1, Math.max(primeiro, Math.ceil((rolagem.esq + rolagem.vista) / slot) - 1));
  const miniY = escalaLinear(yEsc.domain(), [MINI_H - 2, 2]);
  const miniSlot = vistaW / n;
  const janela = rolagem.total > 0 ? { x: (rolagem.esq / rolagem.total) * vistaW, w: (rolagem.vista / rolagem.total) * vistaW } : { x: 0, w: vistaW };

  return (
    <div className="relative min-w-0">
      <div
        role="group"
        aria-roledescription="gráfico de barras com rolagem"
        aria-label={`${titulo}. Use as setas para percorrer os dias.`}
        tabIndex={0}
        className={cx("relative rounded-v2-sm", foco)}
        onKeyDown={aoTeclar}
        onFocus={handlers.onFocus}
        onBlur={handlers.onBlur}
      >
        <div className="flex">
          <svg width={esq} height={altura} aria-hidden="true" className="block shrink-0">
            <g transform={`translate(0 ${MARGEM.topo})`}>
              {ticks.map((t) => (
                <text key={t} x={esq - 8} y={yEsc(t)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill={COR.textoMudo}>
                  {fy(t)}
                </text>
              ))}
            </g>
          </svg>
          <div className="relative min-w-0 flex-1">
            <div
              ref={vpRef}
              onScroll={atualizar}
              onPointerDown={aoApertar}
              onPointerMove={aoMover}
              onPointerUp={aoSoltar}
              onPointerCancel={aoSoltar}
              className={cx(
                "overflow-x-auto overflow-y-hidden overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                !cabe && "cursor-grab active:cursor-grabbing",
              )}
              style={{ height: altura }}
            >
              <svg width={total} height={altura} aria-hidden="true" className="block">
                <GradienteBarra id={idGrad} cor={cor} horizontal={false} />
                <g transform={`translate(0 ${MARGEM.topo})`}>
                  {ticks.map((t) => (
                    <line key={t} x1={0} x2={total} y1={yEsc(t)} y2={yEsc(t)} stroke={COR.grade} />
                  ))}
                  <line x1={0} x2={total} y1={zero} y2={zero} stroke={COR.eixo} />
                  {pontos.map((p, i) =>
                    i % saltoRotulos === 0 ? (
                      <text
                        key={p.x}
                        x={Math.max(22, Math.min(total - 22, i * slot + slot / 2))}
                        y={areaH + 18}
                        textAnchor="middle"
                        fontSize={11}
                        fill={COR.textoMudo}
                      >
                        {formatarDataCurta(p.x)}
                      </text>
                    ) : null,
                  )}
                  {ativo !== null ? <rect x={ativo * slot} y={0} width={slot} height={areaH} fill={COR.cursor} opacity={0.14} /> : null}
                  <CamadaAnimada animKey={animKey}>
                    {pontos.map((p, i) => {
                      const h = p.y === 0 ? 0 : Math.max(2, Math.abs(yEsc(p.y) - zero));
                      const positivo = p.y >= 0;
                      return (
                        <path
                          key={p.x}
                          d={caminhoBarra(i * slot + (slot - espessura) / 2, positivo ? zero - h : zero, espessura, h, RAIO, positivo ? "topo" : "base")}
                          fill={`url(#${idGrad})`}
                          className="v2-g v2-g-sobe"
                          style={
                            {
                              "--i": i * passoEscalona,
                              opacity: ativo === null || ativo === i ? 1 : 0.5,
                              ...(p.y < 0 ? { transformOrigin: "top" } : null),
                            } as React.CSSProperties
                          }
                        />
                      );
                    })}
                  </CamadaAnimada>
                  {/* Alvo do ponteiro: a faixa inteira do dia, maior que a barra. */}
                  {pontos.map((p, i) => (
                    <rect
                      key={p.x}
                      x={i * slot}
                      y={0}
                      width={slot}
                      height={areaH}
                      fill="transparent"
                      onPointerEnter={() => setAtivo(i)}
                      onPointerDown={() => setAtivo(i)}
                      onPointerLeave={() => setAtivo(null)}
                    />
                  ))}
                </g>
              </svg>
            </div>
            {/* Sinal de que há mais barras de cada lado: o fundo do card cobre a ponta. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-0 w-8 transition-opacity duration-200"
              style={{ opacity: !cabe && rolagem.esq > 2 ? 1 : 0, background: "linear-gradient(to right, var(--v2-casco), transparent)" }}
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-0 w-8 transition-opacity duration-200"
              style={{
                opacity: !cabe && rolagem.esq + rolagem.vista < rolagem.total - 2 ? 1 : 0,
                background: "linear-gradient(to left, var(--v2-casco), transparent)",
              }}
            />
          </div>
        </div>
        {b ? (
          <TooltipGrafico
            x={esq + ativoX - rolagem.esq}
            y={MARGEM.topo + bTopo - 8}
            larguraContainer={largura}
            titulo={formatarDataLonga(b.x)}
            linhas={[{ cor, rotulo: titulo, valor: formatarY(b.y) }]}
          />
        ) : null}
        <div aria-live="polite" className="sr-only">
          {b ? `${formatarDataLonga(b.x)}: ${formatarY(b.y)}` : ""}
        </div>
        <TabelaDados legenda={titulo} colunas={["Dia", "Valor"]} linhas={pontos.map((p) => [formatarDataLonga(p.x), formatarY(p.y)])} />
      </div>
      {!cabe ? (
        <div aria-hidden="true" className="mt-2" style={{ paddingLeft: esq }}>
          <svg width={vistaW} height={MINI_H} className="block cursor-grab touch-none active:cursor-grabbing" onPointerDown={miniApertar} onPointerMove={miniMover} onPointerUp={miniSoltar} onPointerCancel={miniSoltar}>
            {pontos.map((p, i) => {
              const h = Math.max(p.y === 0 ? 0 : 1, Math.abs(miniY(p.y) - miniY(0)));
              return <rect key={p.x} x={i * miniSlot + miniSlot * 0.15} y={miniY(0) - h} width={Math.max(1, miniSlot * 0.7)} height={h} fill={cor} opacity={0.5} />;
            })}
            <rect x={janela.x + 0.5} y={0.5} width={Math.max(8, janela.w - 1)} height={MINI_H - 1} rx={4} fill={cor} fillOpacity={0.14} stroke={cor} strokeOpacity={0.75} />
          </svg>
          <p className="mt-1 text-xs text-v2-nevoa/60">
            {formatarDataCurta(pontos[primeiro].x)} a {formatarDataCurta(pontos[ultimo].x)} de {n} dias · arraste para ver o histórico
          </p>
        </div>
      ) : null}
    </div>
  );
}
