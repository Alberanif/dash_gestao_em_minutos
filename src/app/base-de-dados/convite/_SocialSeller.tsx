"use client";

import { useEffect, useState } from "react";
import type { SocialSellerRow } from "@/types/base-de-dados";
import { labelStyle, cellStyle, thStyle } from "./_styles";

function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export default function SocialSeller() {
  const [rows, setRows] = useState<SocialSellerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ week_start: "", week_end: "", reunioes_realizadas: "", vendas_realizadas: "" });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/base-de-dados/convite/social-seller")
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
      const res = await fetch("/api/base-de-dados/convite/social-seller", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          week_start: form.week_start,
          week_end: form.week_end,
          reunioes_realizadas: parseInt(form.reunioes_realizadas, 10),
          vendas_realizadas: parseInt(form.vendas_realizadas, 10),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Erro ao salvar");
      }
      const savedRow: SocialSellerRow = await res.json();
      setRows((prev) => [savedRow, ...prev]);
      setForm({ week_start: "", week_end: "", reunioes_realizadas: "", vendas_realizadas: "" });
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
    form.reunioes_realizadas !== "" &&
    !isNaN(parseInt(form.reunioes_realizadas, 10)) &&
    form.vendas_realizadas !== "" &&
    !isNaN(parseInt(form.vendas_realizadas, 10));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="bdd-section-label">
        <span className="bdd-section-label-bar" />
        <span className="bdd-section-label-text">Social Seller</span>
      </div>

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

      <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-card)", overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--color-bg)" }}>
              <th style={thStyle}>Semana</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Reuniões Realizadas</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Vendas Realizadas</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [0, 1, 2].map((i) => (
                <tr key={i} style={{ borderTop: "1px solid var(--color-border)" }}>
                  {[0, 1, 2].map((j) => (
                    <td key={j} style={cellStyle}>
                      <div style={{ height: 14, width: j === 0 ? "60%" : 40, borderRadius: 4, background: "var(--color-bg)", animation: "pulse 1.5s ease-in-out infinite", marginLeft: j === 0 ? undefined : "auto" }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ ...cellStyle, textAlign: "center", color: "var(--color-text-muted)", padding: "32px 16px" }}>
                  Nenhum registro ainda. Adicione o primeiro abaixo.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} style={{ borderTop: "1px solid var(--color-border)" }}>
                  <td style={cellStyle}>{fmtDate(row.week_start)} — {fmtDate(row.week_end)}</td>
                  <td style={{ ...cellStyle, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{row.reunioes_realizadas.toLocaleString("pt-BR")}</td>
                  <td style={{ ...cellStyle, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{row.vendas_realizadas.toLocaleString("pt-BR")}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-card)", padding: "20px", display: "flex", flexDirection: "column", gap: 16 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>
          Novo registro
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>Início da semana</label>
            <input type="date" className="field-control" value={form.week_start} onChange={(e) => handleChange("week_start", e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Fim da semana</label>
            <input type="date" className="field-control" value={form.week_end} onChange={(e) => handleChange("week_end", e.target.value)} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>Reuniões Realizadas</label>
            <input type="number" min={0} step={1} className="field-control" placeholder="0" value={form.reunioes_realizadas} onChange={(e) => handleChange("reunioes_realizadas", e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Vendas Realizadas</label>
            <input type="number" min={0} step={1} className="field-control" placeholder="0" value={form.vendas_realizadas} onChange={(e) => handleChange("vendas_realizadas", e.target.value)} />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button onClick={handleSave} disabled={!canSave} className="btn-primary">
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
