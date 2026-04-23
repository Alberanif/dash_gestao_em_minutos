"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { AtencaoRow } from "@/types/base-de-dados";

function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

const inputStyle: React.CSSProperties = {
  padding: "7px 10px",
  fontSize: 13,
  border: "1px solid var(--color-border)",
  background: "var(--color-bg)",
  color: "var(--color-text)",
  borderRadius: "var(--radius-sm)",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  color: "var(--color-text-muted)",
  marginBottom: 4,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const cellStyle: React.CSSProperties = {
  padding: "11px 16px",
  fontSize: 13,
  color: "var(--color-text)",
};

const thStyle: React.CSSProperties = {
  padding: "10px 16px",
  fontSize: 11,
  fontWeight: 600,
  color: "var(--color-text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  textAlign: "left",
};

export default function AtencaoPage() {
  const [rows, setRows] = useState<AtencaoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ week_start: "", week_end: "", oportunidades: "" });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/base-de-dados/atencao")
      .then((r) => r.json())
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  function handleChange(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setDirty(true);
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/base-de-dados/atencao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          week_start: form.week_start,
          week_end: form.week_end,
          oportunidades: parseInt(form.oportunidades, 10),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Erro ao salvar");
      }
      const saved: AtencaoRow = await res.json();
      setRows((prev) => [saved, ...prev]);
      setForm({ week_start: "", week_end: "", oportunidades: "" });
      setDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  const canSave =
    dirty &&
    !saving &&
    form.week_start !== "" &&
    form.week_end !== "" &&
    form.oportunidades !== "" &&
    !isNaN(parseInt(form.oportunidades, 10));

  return (
    <div
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "32px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 24,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <Link
          href="/base-de-dados"
          style={{
            fontSize: 13,
            color: "var(--color-text-muted)",
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          ← Voltar
        </Link>
        <h1
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: "var(--color-text)",
            margin: 0,
          }}
        >
          Atenção
        </h1>
      </div>

      {/* Unsaved changes banner */}
      {dirty && !saving && (
        <div
          style={{
            background: "#fefce8",
            border: "1px solid #fbbf24",
            borderRadius: "var(--radius-card)",
            padding: "10px 16px",
            fontSize: 13,
            color: "#92400e",
          }}
        >
          Você tem alterações não salvas. Clique em &quot;Salvar&quot; para registrar os dados.
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #fca5a5",
            borderRadius: "var(--radius-card)",
            padding: "10px 16px",
            fontSize: 13,
            color: "#991b1b",
          }}
        >
          {error}
        </div>
      )}

      {/* Data table */}
      <div
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-card)",
          overflow: "hidden",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--color-bg)" }}>
              <th style={thStyle}>Semana</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Oportunidades</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [0, 1, 2].map((i) => (
                <tr key={i} style={{ borderTop: "1px solid var(--color-border)" }}>
                  <td style={cellStyle}>
                    <div
                      style={{
                        height: 14,
                        width: "60%",
                        borderRadius: 4,
                        background: "var(--color-bg)",
                        animation: "pulse 1.5s ease-in-out infinite",
                      }}
                    />
                  </td>
                  <td style={{ ...cellStyle, textAlign: "right" }}>
                    <div
                      style={{
                        height: 14,
                        width: 40,
                        borderRadius: 4,
                        background: "var(--color-bg)",
                        animation: "pulse 1.5s ease-in-out infinite",
                        marginLeft: "auto",
                      }}
                    />
                  </td>
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={2}
                  style={{
                    ...cellStyle,
                    textAlign: "center",
                    color: "var(--color-text-muted)",
                    padding: "24px 16px",
                  }}
                >
                  Nenhum registro ainda
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} style={{ borderTop: "1px solid var(--color-border)" }}>
                  <td style={cellStyle}>
                    {fmtDate(row.week_start)} — {fmtDate(row.week_end)}
                  </td>
                  <td style={{ ...cellStyle, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {row.oportunidades.toLocaleString("pt-BR")}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* New row form */}
      <div
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-card)",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <p
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--color-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            margin: 0,
          }}
        >
          Novo registro
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>Início</label>
            <input
              type="date"
              style={inputStyle}
              value={form.week_start}
              onChange={(e) => handleChange("week_start", e.target.value)}
            />
          </div>
          <div>
            <label style={labelStyle}>Fim</label>
            <input
              type="date"
              style={inputStyle}
              value={form.week_end}
              onChange={(e) => handleChange("week_end", e.target.value)}
            />
          </div>
          <div>
            <label style={labelStyle}>Oportunidades</label>
            <input
              type="number"
              min={0}
              style={inputStyle}
              placeholder="0"
              value={form.oportunidades}
              onChange={(e) => handleChange("oportunidades", e.target.value)}
            />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={handleSave}
            disabled={!canSave}
            style={{
              padding: "9px 24px",
              fontSize: 13,
              fontWeight: 600,
              borderRadius: "var(--radius-sm)",
              border: "none",
              background: canSave ? "#059669" : "var(--color-border)",
              color: canSave ? "#fff" : "var(--color-text-muted)",
              cursor: canSave ? "pointer" : "not-allowed",
              transition: "background 0.15s",
            }}
          >
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
