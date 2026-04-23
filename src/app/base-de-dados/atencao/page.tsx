"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { AtencaoRow } from "@/types/base-de-dados";

function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
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
  const [saved, setSaved] = useState(false);
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
    setSaved(false);
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
      setSaved(true);
      setTimeout(() => setSaved(false), 3500);
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
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 0 40px" }}>
      {/* Page header */}
      <header className="bdd-page-header">
        <Link href="/base-de-dados" className="bdd-back-link">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Voltar
        </Link>
        <span style={{ color: "var(--color-border)", fontSize: 18, userSelect: "none" }}>/</span>
        <h1 className="bdd-page-title">Atenção</h1>
      </header>

      <div style={{ padding: "24px 24px 0", display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Banners */}
        {dirty && !saving && !saved && (
          <div className="bdd-warning-banner">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            Você tem alterações não salvas. Clique em &quot;Salvar&quot; para registrar.
          </div>
        )}
        {saved && (
          <div className="bdd-success-banner">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Registro salvo com sucesso!
          </div>
        )}
        {error && (
          <div className="bdd-error-banner">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {error}
          </div>
        )}

        {/* Section title */}
        <div className="bdd-section-label">
          <span className="bdd-section-label-bar" />
          <span className="bdd-section-label-text">Oportunidades por Semana</span>
        </div>

        {/* Data table */}
        <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-card)", overflow: "auto" }}>
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
                      <div style={{ height: 14, width: "60%", borderRadius: 4, background: "var(--color-bg)", animation: "pulse 1.5s ease-in-out infinite" }} />
                    </td>
                    <td style={{ ...cellStyle, textAlign: "right" }}>
                      <div style={{ height: 14, width: 40, borderRadius: 4, background: "var(--color-bg)", animation: "pulse 1.5s ease-in-out infinite", marginLeft: "auto" }} />
                    </td>
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={2} style={{ ...cellStyle, textAlign: "center", color: "var(--color-text-muted)", padding: "32px 16px" }}>
                    Nenhum registro ainda. Adicione o primeiro abaixo.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} style={{ borderTop: "1px solid var(--color-border)" }}>
                    <td style={cellStyle}>{fmtDate(row.week_start)} — {fmtDate(row.week_end)}</td>
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
        <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-card)", padding: "20px", display: "flex", flexDirection: "column", gap: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>
            Novo registro
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Início da semana</label>
              <input
                type="date"
                className="field-control"
                value={form.week_start}
                onChange={(e) => handleChange("week_start", e.target.value)}
              />
            </div>
            <div>
              <label style={labelStyle}>Fim da semana</label>
              <input
                type="date"
                className="field-control"
                value={form.week_end}
                onChange={(e) => handleChange("week_end", e.target.value)}
              />
            </div>
            <div>
              <label style={labelStyle}>Oportunidades</label>
              <input
                type="number"
                min={0}
                className="field-control"
                placeholder="0"
                value={form.oportunidades}
                onChange={(e) => handleChange("oportunidades", e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button onClick={handleSave} disabled={!canSave} className="btn-primary">
              {saving ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
