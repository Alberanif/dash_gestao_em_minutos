"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { AiReportKpiBlock, AiReportKpiSnapshot } from "@/types/indicadores";

const ROTATION_MS = 30_000;

/** Props-driven; dados vêm de um hook em outra task (ver PRD_2026-07-16_six_dados.md). */
export interface SixDadosCardData {
  filterId: string;
  name: string;
  reportText: string | null;
  /** KPIs vêm daqui (bloco lifetime), NUNCA do texto da IA. */
  kpiSnapshot: AiReportKpiSnapshot | null;
  /** ISO; rodapé "Atualizado há X min". */
  generatedAt: string | null;
  /** generating => skeleton; error sem reportText => "resumo indisponível"; error com reportText => texto antigo + aviso de desatualizado. */
  status: "ready" | "generating" | "error";
}

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
const fmtNum = (v: number) => new Intl.NumberFormat("pt-BR").format(v);
const fmtROAS = (v: number) => `${v.toFixed(1)}x`;

function fmtKpi(value: number | null, formatter: (v: number) => string): string {
  return value == null ? "—" : formatter(value);
}

function fmtUpdatedAt(generatedAt: string | null, now: number): string | null {
  if (!generatedAt) return null;
  const generatedMs = new Date(generatedAt).getTime();
  if (Number.isNaN(generatedMs)) return null;
  const diffMin = Math.max(0, Math.round((now - generatedMs) / 60_000));
  if (diffMin < 1) return "Atualizado agora mesmo";
  if (diffMin < 60) return `Atualizado há ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  return `Atualizado há ${diffH} h`;
}

function readReducedMotionPreference(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(readReducedMotionPreference);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  return reduced;
}

interface KpiRowProps {
  block: AiReportKpiBlock | null;
}

function SixDadosKpiRow({ block }: KpiRowProps) {
  const cells: Array<{ label: string; value: string }> = [
    { label: "ROAS", value: fmtKpi(block?.roas ?? null, fmtROAS) },
    { label: "Receita", value: fmtKpi(block?.revenueBrl ?? null, fmtBRL) },
    { label: "Leads", value: fmtKpi(block?.leads ?? null, fmtNum) },
    { label: "CPL", value: fmtKpi(block?.cpl ?? null, fmtBRL) },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginTop: 14 }}>
      {cells.map((cell) => (
        <div
          key={cell.label}
          style={{ background: "var(--surface-2)", borderRadius: 8, padding: "9px 8px", textAlign: "center" }}
        >
          <div
            style={{
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              color: "var(--text-3)",
              marginBottom: 5,
            }}
          >
            {cell.label}
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", lineHeight: 1 }}>{cell.value}</div>
        </div>
      ))}
    </div>
  );
}

function SkeletonLine({ width = "100%", height = 12 }: { width?: string; height?: number }) {
  return (
    <div
      style={{
        height,
        width,
        borderRadius: 5,
        background: "var(--border-vis)",
        animation: "pulse 1.5s ease-in-out infinite",
      }}
    />
  );
}

function SixDadosFullSkeleton({ filterId, name }: { filterId: string; name: string }) {
  return (
    <div data-testid={`six-dados-skeleton-${filterId}`} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginTop: 14 }}>
        {["ROAS", "Receita", "Leads", "CPL"].map((label) => (
          <div key={label} style={{ background: "var(--surface-2)", borderRadius: 8, padding: "9px 8px" }}>
            <div style={{ fontSize: 9, fontWeight: 600, color: "var(--text-3)", marginBottom: 5, textAlign: "center" }}>
              {label}
            </div>
            <SkeletonLine height={15} width="70%" />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
        <SkeletonLine />
        <SkeletonLine />
        <SkeletonLine width="70%" />
      </div>
      <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
        Gerando resumo de {name}…
      </span>
    </div>
  );
}

function SixDadosNarrativeSkeleton({ filterId }: { filterId: string }) {
  return (
    <div data-testid={`six-dados-narrative-skeleton-${filterId}`} style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 14 }}>
      <SkeletonLine />
      <SkeletonLine />
      <SkeletonLine width="70%" />
    </div>
  );
}

function SixDadosDots({
  items,
  activeIndex,
  onSelect,
}: {
  items: SixDadosCardData[];
  activeIndex: number;
  onSelect: (index: number) => void;
}) {
  if (items.length < 2) return null;

  return (
    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
      {items.map((it, index) => (
        <button
          key={it.filterId}
          type="button"
          data-testid={`six-dados-dot-${index}`}
          aria-label={`Ir para ${it.name}`}
          aria-current={index === activeIndex}
          onClick={() => onSelect(index)}
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            padding: 0,
            border: "none",
            cursor: "pointer",
            background: index === activeIndex ? "var(--text-strong)" : "var(--border-vis)",
          }}
        />
      ))}
    </div>
  );
}

function SixDadosCard({
  item,
  now,
  items,
  activeIndex,
  onSelectIndex,
}: {
  item: SixDadosCardData;
  now: number;
  items: SixDadosCardData[];
  activeIndex: number;
  onSelectIndex: (index: number) => void;
}) {
  const fullSkeleton = item.status === "generating" && !item.kpiSnapshot;
  const updatedLabel = fmtUpdatedAt(item.generatedAt, now);
  const stale = item.status === "error" && !!item.reportText;
  const unavailable = item.status === "error" && !item.reportText;

  return (
    <div
      data-testid={`six-dados-card-${item.filterId}`}
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border-vis)",
        borderRadius: 11,
        padding: "18px 20px 16px",
        display: "flex",
        flexDirection: "column",
        minHeight: 220,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)", lineHeight: 1.3 }}>
          {item.name}
        </span>
        <SixDadosDots items={items} activeIndex={activeIndex} onSelect={onSelectIndex} />
      </div>

      {fullSkeleton ? (
        <SixDadosFullSkeleton filterId={item.filterId} name={item.name} />
      ) : (
        <>
          <SixDadosKpiRow block={item.kpiSnapshot?.lifetime ?? null} />

          {item.status === "generating" ? (
            <SixDadosNarrativeSkeleton filterId={item.filterId} />
          ) : unavailable ? (
            <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 14, fontStyle: "italic" }}>
              Resumo indisponível no momento.
            </p>
          ) : (
            <p style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.55, marginTop: 14 }}>
              {item.reportText}
            </p>
          )}

          {stale && (
            <div style={{ fontSize: 11, color: "var(--amber, #b98b2e)", marginTop: 8 }}>
              Relatório desatualizado — nova geração falhou, exibindo a última versão disponível.
            </div>
          )}

          {updatedLabel && (
            <div
              style={{
                fontSize: 11,
                color: "var(--text-3)",
                marginTop: "auto",
                paddingTop: 12,
              }}
            >
              {updatedLabel}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export interface SixDadosCarouselProps {
  items: SixDadosCardData[];
}

export function SixDadosCarousel({ items }: SixDadosCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const reducedMotion = useReducedMotion();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const count = items.length;
  // Se o número de itens mudar (evento saiu/entrou de ativo), evita índice fora de faixa.
  const safeIndex = count === 0 ? 0 : Math.min(activeIndex, count - 1);

  const clearRotationTimer = () => {
    if (intervalRef.current != null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => {
    if (count < 2 || paused) {
      clearRotationTimer();
      return;
    }
    intervalRef.current = setInterval(() => {
      setNow(Date.now());
      // Clampa a partir do índice visível (safeIndex) antes de avançar: se `items`
      // encolheu, `prev` pode apontar além do novo fim e um avanço ingênuo
      // recairia no mesmo índice clampado, travando um ciclo inteiro de rotação.
      setActiveIndex((prev) => (Math.min(prev, count - 1) + 1) % count);
    }, ROTATION_MS);
    return clearRotationTimer;
  }, [count, paused, activeIndex]);

  // Ticker independente da rotação: garante que o rodapé "Atualizado há X min"
  // continue avançando mesmo quando há 0 ou 1 item (sem intervalo de rotação).
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ROTATION_MS);
    return () => clearInterval(id);
  }, []);

  const goTo = (index: number) => {
    setNow(Date.now());
    setActiveIndex(index);
  };

  const goNext = () => goTo((safeIndex + 1) % count);
  const goPrev = () => goTo((safeIndex - 1 + count) % count);

  const activeItem = useMemo(() => items[safeIndex], [items, safeIndex]);

  if (count === 0) return null;

  const showControls = count > 1;

  return (
    <div
      data-testid="six-dados-carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {showControls && (
          <button
            type="button"
            data-testid="six-dados-prev"
            aria-label="Evento anterior"
            onClick={goPrev}
            style={navButtonStyle}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        )}

        {/*
          Troca é sempre seca (sem slide/crossfade) — nenhuma animação a suprimir.
          data-motion documenta a preferência lida via matchMedia para estilos futuros.
        */}
        <div data-motion={reducedMotion ? "reduce" : "safe"} style={{ flex: 1, minWidth: 0 }}>
          <SixDadosCard item={activeItem} now={now} items={items} activeIndex={safeIndex} onSelectIndex={goTo} />
        </div>

        {showControls && (
          <button
            type="button"
            data-testid="six-dados-next"
            aria-label="Próximo evento"
            onClick={goNext}
            style={navButtonStyle}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

const navButtonStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 28,
  height: 28,
  borderRadius: 8,
  border: "1px solid var(--border-vis)",
  background: "var(--surface-2)",
  color: "var(--text-2)",
  cursor: "pointer",
  flexShrink: 0,
  padding: 0,
};
