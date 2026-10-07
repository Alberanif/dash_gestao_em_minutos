"use client";

import { useEffect, useState } from "react";
import type { GlobalMetrics, MetaCampaignsResponse } from "@/types/indicadores";

export const CAMPAIGNS_PAGE_SIZE = 5;
export const SEARCH_DEBOUNCE_MS = 300;
export const SEARCH_MAX_LENGTH = 100;

interface MetaCampaignsListProps {
  /** Query string já montada (com "?"), a mesma de /api/indicadores/metrics. */
  params: string;
  onBack: () => void;
}

type ListState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; data: MetaCampaignsResponse };

function fmtBRL2(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `${n.toFixed(2)}%`;
}

function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(n);
}

const HEADERS = [
  "Nome",
  "Investimento",
  "Leads",
  "CPM",
  "CTR",
  "CPL Tráfego",
  "Connect Rate",
  "Conv. LP",
  "Checkout",
];

function metricCells(m: GlobalMetrics): string[] {
  return [
    fmtBRL2(m.meta_spend),
    fmtNum(m.meta_leads),
    fmtBRL2(m.meta_cpm),
    fmtPct(m.meta_ctr),
    fmtBRL2(m.meta_cpl_traffic),
    fmtPct(m.meta_connect_rate),
    fmtPct(m.meta_lp_conversion),
    fmtNum(m.meta_checkout),
  ];
}

function hiddenText(n: number): string {
  return `${n} ${n === 1 ? "campanha sem gasto oculta" : "campanhas sem gasto ocultas"}`;
}

const cellStyle: React.CSSProperties = {
  padding: "9px 12px",
  fontSize: 12,
  textAlign: "right",
  whiteSpace: "nowrap",
  color: "var(--text-strong)",
  borderBottom: "1px solid var(--border-vis)",
};

const nameCellStyle: React.CSSProperties = {
  ...cellStyle,
  textAlign: "left",
  whiteSpace: "normal",
  minWidth: 180,
  maxWidth: 280,
};

const btnStyle: React.CSSProperties = {
  border: "1px solid var(--border-vis)",
  background: "var(--surface-2)",
  color: "var(--text-strong)",
  borderRadius: 6,
  padding: "5px 12px",
  fontFamily: "inherit",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};

export function MetaCampaignsList({ params, onBack }: MetaCampaignsListProps) {
  const [state, setState] = useState<ListState>({ status: "loading" });
  const [page, setPage] = useState(0);
  const [input, setInput] = useState("");
  const [term, setTerm] = useState("");

  // O termo só chega à API ~300 ms depois da última tecla.
  useEffect(() => {
    const id = setTimeout(() => setTerm(input.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [input]);

  // Recarrega (e volta à página 1) quando período/filtro mudam. O flag
  // `cancelled` descarta a resposta de uma busca já substituída por outra.
  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    setPage(0);
    const url = term
      ? `/api/indicadores/campaigns${params}&q=${encodeURIComponent(term)}`
      : `/api/indicadores/campaigns${params}`;
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<MetaCampaignsResponse>;
      })
      .then((data) => {
        if (!cancelled) setState({ status: "ready", data });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [params, term]);

  const header = (
    <div
      style={{
        padding: "14px 22px 0",
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <button type="button" onClick={onBack} style={btnStyle}>
        ← Voltar
      </button>
      <div style={{ position: "relative", flex: "1 1 220px", maxWidth: 360 }}>
        <input
          type="text"
          value={input}
          maxLength={SEARCH_MAX_LENGTH}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Buscar campanha por nome"
          aria-label="Buscar campanha por nome"
          style={{
            width: "100%",
            boxSizing: "border-box",
            border: "1px solid var(--border-vis)",
            background: "var(--surface-2)",
            color: "var(--text-strong)",
            borderRadius: 6,
            padding: "5px 28px 5px 10px",
            fontFamily: "inherit",
            fontSize: 12,
          }}
        />
        {input && (
          <button
            type="button"
            aria-label="Limpar busca"
            onClick={() => setInput("")}
            style={{
              position: "absolute",
              right: 4,
              top: "50%",
              transform: "translateY(-50%)",
              border: "none",
              background: "transparent",
              color: "var(--text-3)",
              cursor: "pointer",
              fontSize: 14,
              lineHeight: 1,
              padding: "2px 6px",
            }}
          >
            ×
          </button>
        )}
      </div>
    </div>
  );

  if (state.status === "loading") {
    return (
      <>
        {header}
        <div style={{ padding: 22 }} aria-busy="true" aria-label="Carregando campanhas">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              style={{
                height: 32,
                marginBottom: 8,
                background: "var(--surface-2)",
                borderRadius: 8,
                animation: "pulse 1.5s ease-in-out infinite",
              }}
            />
          ))}
        </div>
      </>
    );
  }

  if (state.status === "error") {
    return (
      <>
        {header}
        <div style={{ padding: 22 }}>
          <span style={{ color: "var(--red)", fontSize: 13 }}>
            Erro ao carregar campanhas do Meta Ads.
          </span>
        </div>
      </>
    );
  }

  const { campaigns, hidden_zero_spend, total } = state.data;

  if (campaigns.length === 0) {
    return (
      <>
        {header}
        <div style={{ padding: 22, color: "var(--text-3)", fontSize: 13 }}>
          {term
            ? `Nenhuma campanha encontrada para '${term}'.`
            : "Nenhuma campanha com gasto no período."}
          {hidden_zero_spend > 0 && (
            <div style={{ marginTop: 6 }}>{hiddenText(hidden_zero_spend)}</div>
          )}
        </div>
      </>
    );
  }

  const pageCount = Math.ceil(campaigns.length / CAMPAIGNS_PAGE_SIZE);
  const current = Math.min(page, pageCount - 1);
  const rows = campaigns.slice(
    current * CAMPAIGNS_PAGE_SIZE,
    (current + 1) * CAMPAIGNS_PAGE_SIZE,
  );

  return (
    <>
      {header}
      <div style={{ padding: 22 }}>
        <div style={{ overflowX: "auto", maxWidth: "100%" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {HEADERS.map((h, i) => (
                  <th
                    key={h}
                    style={{
                      ...cellStyle,
                      textAlign: i === 0 ? "left" : "right",
                      color: "var(--text-3)",
                      fontWeight: 600,
                      fontSize: 11,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.campaign_id} data-testid="campaign-row">
                  <td style={nameCellStyle}>{c.campaign_name}</td>
                  {metricCells(c).map((v, i) => (
                    <td key={i} style={cellStyle}>
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr data-testid="campaign-total">
                <td style={{ ...nameCellStyle, fontWeight: 700 }}>Total</td>
                {metricCells(total).map((v, i) => (
                  <td key={i} style={{ ...cellStyle, fontWeight: 700 }}>
                    {v}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>

        {hidden_zero_spend > 0 && (
          <div style={{ marginTop: 12, fontSize: 12, color: "var(--text-3)" }}>
            {hiddenText(hidden_zero_spend)}
          </div>
        )}

        {pageCount > 1 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              marginTop: 14,
            }}
          >
            <button
              type="button"
              style={{ ...btnStyle, opacity: current === 0 ? 0.5 : 1 }}
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
            >
              Anterior
            </button>
            <span style={{ fontSize: 12, color: "var(--text-3)" }}>
              Página {current + 1} de {pageCount}
            </span>
            <button
              type="button"
              style={{ ...btnStyle, opacity: current >= pageCount - 1 ? 0.5 : 1 }}
              disabled={current >= pageCount - 1}
              onClick={() => setPage(current + 1)}
            >
              Próxima
            </button>
          </div>
        )}
      </div>
    </>
  );
}
