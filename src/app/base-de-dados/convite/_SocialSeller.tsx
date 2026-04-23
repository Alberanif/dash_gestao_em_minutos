"use client";

import { useEffect, useState } from "react";
import type { SocialSellerRow } from "@/types/base-de-dados";
import { inputStyle, labelStyle, cellStyle, thStyle } from "./_styles";

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
      const saved: SocialSellerRow = await res.json();
      setRows((prev) => [saved, ...prev]);
      setForm({ week_start: "", week_end: "", reunioes_realizadas: "", vendas_realizadas: "" });
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
    form.reunioes_realizadas !== "" &&
    !isNaN(parseInt(form.reunioes_realizadas, 10)) &&
    form.vendas_realizadas !== "" &&
    !isNaN(parseInt(form.vendas_realizadas, 10));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <p style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>
        Social Seller
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
                <td colSpan={3} style={{ ...cellStyle, textAlign: "center", color: "var(--color-text-muted)", padding: "24px 16px" }}>
                  Nenhum registro ainda
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

      <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-card)", padding: "20px", display: "flex", flexDirection: "column", gap: 12 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>
          Novo registro
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>Início</label>
            <input type="date" style={inputStyle} value={form.week_start} onChange={(e) => handleChange("week_start", e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Fim</label>
            <input type="date" style={inputStyle} value={form.week_end} onChange={(e) => handleChange("week_end", e.target.value)} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>Reuniões Realizadas</label>
            <input type="number" min={0} step={1} style={inputStyle} placeholder="0" value={form.reunioes_realizadas} onChange={(e) => handleChange("reunioes_realizadas", e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Vendas Realizadas</label>
            <input type="number" min={0} step={1} style={inputStyle} placeholder="0" value={form.vendas_realizadas} onChange={(e) => handleChange("vendas_realizadas", e.target.value)} />
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
