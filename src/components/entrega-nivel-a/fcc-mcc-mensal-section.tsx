"use client";

import { useEffect, useState } from "react";
import type { EntregaNivelAFccMccMensalRow } from "@/types/entrega-nivel-a";

function fmtMonthYear(monthYear: string) {
  return new Date(monthYear + "T12:00:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

const fmtInt = (n: number) => n.toLocaleString("pt-BR");

function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "var(--color-bg)", borderRadius: "var(--radius-sm)", padding: "10px 12px" }}>
      <p style={{ margin: 0, fontSize: 11, color: "var(--color-text-muted)" }}>{label}</p>
      <p style={{ margin: "4px 0 0", fontSize: 14, fontWeight: 700, color: "var(--color-text)" }}>
        {value}
      </p>
    </div>
  );
}

export function FccMccMensalSection() {
  const [rows, setRows] = useState<EntregaNivelAFccMccMensalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/base-de-dados/entrega-nivel-a/fcc-mcc-mensal")
      .then((r) => r.json())
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("ena-mensal-fcc-mcc");
    if (stored) {
      setSelectedMonths(JSON.parse(stored));
    }
  }, []);

  function handleToggleMonth(monthYear: string) {
    let updated: string[];
    if (selectedMonths.includes(monthYear)) {
      updated = selectedMonths.filter((m) => m !== monthYear);
    } else {
      updated = [...selectedMonths, monthYear];
    }
    setSelectedMonths(updated);
    localStorage.setItem("ena-mensal-fcc-mcc", JSON.stringify(updated));
  }

  const availableMonths = Array.from(new Set(rows.map((r) => r.month_year)))
    .sort()
    .reverse();
  const dataMap = new Map(rows.map((r) => [r.month_year, r]));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--color-text)" }}>
            FCC e MCC — Mensal
          </h2>
        </div>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--color-text-muted)",
            background: "var(--color-bg)",
            border: "1px solid var(--color-border)",
            borderRadius: 99,
            padding: "2px 10px",
          }}
        >
          {availableMonths.length} {availableMonths.length === 1 ? "mês" : "meses"}
        </span>
      </div>

      {loading ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                height: 32,
                width: 100,
                borderRadius: "var(--radius-sm)",
                background: "var(--color-bg)",
                animation: "pulse 1.5s ease-in-out infinite",
              }}
            />
          ))}
        </div>
      ) : availableMonths.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: "var(--color-text-muted)" }}>
          Nenhum mês disponível
        </p>
      ) : (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {availableMonths.map((monthYear) => {
            const isSelected = selectedMonths.includes(monthYear);
            return (
              <button
                key={monthYear}
                onClick={() => handleToggleMonth(monthYear)}
                style={{
                  padding: "6px 12px",
                  fontSize: 13,
                  fontWeight: 600,
                  borderRadius: "var(--radius-sm)",
                  border: isSelected ? "none" : "1px solid var(--color-border)",
                  background: isSelected ? "var(--color-primary)" : "transparent",
                  color: isSelected ? "#fff" : "var(--color-text)",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                {fmtMonthYear(monthYear)}
              </button>
            );
          })}
        </div>
      )}

      {selectedMonths.length === 0 ? (
        <div
          style={{
            background: "var(--color-surface)",
            border: "1px dashed var(--color-border)",
            borderRadius: "var(--radius-card)",
            padding: "28px 24px",
            textAlign: "center",
          }}
        >
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--color-text)" }}>
            Nenhum mês selecionado
          </p>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
            Clique em um mês acima para visualizar os dados.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 16,
          }}
        >
          {selectedMonths.map((monthYear) => {
            const data = dataMap.get(monthYear);
            return (
              <div
                key={monthYear}
                style={{
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-card)",
                  padding: "16px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--color-text)" }}>
                    {fmtMonthYear(monthYear)}
                  </p>
                  <button
                    onClick={() => handleToggleMonth(monthYear)}
                    style={{
                      background: "transparent",
                      border: "none",
                      fontSize: 18,
                      color: "var(--color-text-muted)",
                      cursor: "pointer",
                      padding: 0,
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                </div>

                {data ? (
                  <>
                    <div style={{ height: 1, background: "var(--color-border)", margin: "12px 0" }} />
                    <MetricCell label="Banco de Formações Não Realizadas — Pago" value={fmtInt(data.banco_formacoes_nao_realizadas_pago)} />
                  </>
                ) : (
                  <p style={{ margin: "12px 0", fontSize: 13, color: "var(--color-text-muted)" }}>
                    Nenhum dado encontrado
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
