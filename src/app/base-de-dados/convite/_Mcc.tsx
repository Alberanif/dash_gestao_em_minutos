"use client";

import { useEffect, useState } from "react";
import type { MccRow } from "@/types/base-de-dados";
import { inputStyle, labelStyle, cellStyle, thStyle } from "./_styles";

const fmtFloat = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2 });

const FLOAT_FIELDS = ["perc_ultimate", "perc_pc_ao_vivo"] as const;

export default function Mcc() {
  const [rows, setRows] = useState<MccRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ projeto: "", perc_ultimate: "", perc_pc_ao_vivo: "" });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/base-de-dados/convite/mcc")
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
      const res = await fetch("/api/base-de-dados/convite/mcc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projeto: form.projeto,
          perc_ultimate: parseFloat(form.perc_ultimate),
          perc_pc_ao_vivo: parseFloat(form.perc_pc_ao_vivo),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Erro ao salvar");
      }
      const saved: MccRow = await res.json();
      setRows((prev) => [saved, ...prev]);
      setForm({ projeto: "", perc_ultimate: "", perc_pc_ao_vivo: "" });
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
    form.projeto.trim() !== "" &&
    FLOAT_FIELDS.every((f) => form[f] !== "" && !isNaN(parseFloat(form[f])));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <p style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>
        Métricas MCC
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
              <th style={thStyle}>Projeto</th>
              <th style={{ ...thStyle, textAlign: "right" }}>% Ultimate</th>
              <th style={{ ...thStyle, textAlign: "right" }}>% PC ao Vivo</th>
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
                  <td style={cellStyle}>{row.projeto}</td>
                  <td style={{ ...cellStyle, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtFloat(row.perc_ultimate)}</td>
                  <td style={{ ...cellStyle, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtFloat(row.perc_pc_ao_vivo)}</td>
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

        <div>
          <label style={labelStyle}>Projeto</label>
          <input type="text" style={inputStyle} placeholder="Nome do projeto" value={form.projeto} onChange={(e) => handleChange("projeto", e.target.value)} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>% Ultimate</label>
            <input type="number" min={0} step={0.01} style={inputStyle} placeholder="0,00" value={form.perc_ultimate} onChange={(e) => handleChange("perc_ultimate", e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>% PC ao Vivo</label>
            <input type="number" min={0} step={0.01} style={inputStyle} placeholder="0,00" value={form.perc_pc_ao_vivo} onChange={(e) => handleChange("perc_pc_ao_vivo", e.target.value)} />
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
