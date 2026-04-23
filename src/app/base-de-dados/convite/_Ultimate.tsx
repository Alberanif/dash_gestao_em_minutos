"use client";

import { useEffect, useState } from "react";
import type { UltimateRow } from "@/types/base-de-dados";
import { inputStyle, labelStyle, cellStyle, thStyle } from "./_styles";

function fmtMonthYear(isoDate: string) {
  return new Date(isoDate + "T12:00:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

export default function Ultimate() {
  const [rows, setRows] = useState<UltimateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ month_year: "", numero_absoluto: "" });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/base-de-dados/convite/ultimate")
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
      const res = await fetch("/api/base-de-dados/convite/ultimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month_year: form.month_year,
          numero_absoluto: parseInt(form.numero_absoluto, 10),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Erro ao salvar");
      }
      const saved: UltimateRow = await res.json();
      setRows((prev) => [saved, ...prev]);
      setForm({ month_year: "", numero_absoluto: "" });
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
    form.month_year !== "" &&
    form.numero_absoluto !== "" &&
    !isNaN(parseInt(form.numero_absoluto, 10));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <p style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>
        Métricas Ultimate
      </p>

      {dirty && !saving && (
        <div style={{ background: "#fefce8", border: "1px solid #fbbf24", borderRadius: "var(--radius-card)", padding: "10px 16px", fontSize: 13, color: "#92400e" }}>
          Você tem alterações não salvas. Clique em &quot;Salvar&quot; para registrar os dados.
        </div>
      )}
      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: "var(--radius-card)", padding: "10px 16px", fontSize: 13, color: "#991b1b" }}>
          {error}
        </div>
      )}

      <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-card)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--color-bg)" }}>
              <th style={thStyle}>Mês/Ano</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Nº Absoluto</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [0, 1, 2].map((i) => (
                <tr key={i} style={{ borderTop: "1px solid var(--color-border)" }}>
                  {[0, 1].map((j) => (
                    <td key={j} style={cellStyle}>
                      <div style={{ height: 14, width: j === 0 ? "60%" : 40, borderRadius: 4, background: "var(--color-bg)", animation: "pulse 1.5s ease-in-out infinite", marginLeft: j === 0 ? undefined : "auto" }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={2} style={{ ...cellStyle, textAlign: "center", color: "var(--color-text-muted)", padding: "24px 16px" }}>
                  Nenhum registro ainda
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} style={{ borderTop: "1px solid var(--color-border)" }}>
                  <td style={cellStyle}>{fmtMonthYear(row.month_year)}</td>
                  <td style={{ ...cellStyle, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{row.numero_absoluto.toLocaleString("pt-BR")}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-card)", padding: "20px", display: "flex", flexDirection: "column", gap: 12 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>
          Novo registro
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>Mês/Ano</label>
            <input type="month" style={inputStyle} value={form.month_year} onChange={(e) => handleChange("month_year", e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Nº Absoluto</label>
            <input type="number" min={0} step={1} style={inputStyle} placeholder="0" value={form.numero_absoluto} onChange={(e) => handleChange("numero_absoluto", e.target.value)} />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={handleSave}
            disabled={!canSave}
            style={{ padding: "9px 24px", fontSize: 13, fontWeight: 600, borderRadius: "var(--radius-sm)", border: "none", background: canSave ? "#059669" : "var(--color-border)", color: canSave ? "#fff" : "var(--color-text-muted)", cursor: canSave ? "pointer" : "not-allowed", transition: "background 0.15s" }}
          >
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
