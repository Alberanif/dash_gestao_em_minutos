"use client";

import { useEffect, useState } from "react";
import type { EntregaNivelAUltimateProjetoRow } from "@/types/base-de-dados";
import { labelStyle, cellStyle, thStyle } from "./_styles";

const fmtPerc = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) + "%";

const FLOAT_FIELDS = ["perc_presenca_encontros_online_dia1", "perc_presenca_encontro_presencial"] as const;

export default function UltimateProjeto() {
  const [rows, setRows] = useState<EntregaNivelAUltimateProjetoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    projeto: "",
    perc_presenca_encontros_online_dia1: "",
    perc_presenca_encontro_presencial: "",
  });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/base-de-dados/entrega-nivel-a/ultimate-projeto")
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
      const res = await fetch("/api/base-de-dados/entrega-nivel-a/ultimate-projeto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projeto: form.projeto,
          perc_presenca_encontros_online_dia1: parseFloat(form.perc_presenca_encontros_online_dia1),
          perc_presenca_encontro_presencial: parseFloat(form.perc_presenca_encontro_presencial),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Erro ao salvar");
      }
      const savedRow: EntregaNivelAUltimateProjetoRow = await res.json();
      setRows((prev) => [savedRow, ...prev]);
      setForm({ projeto: "", perc_presenca_encontros_online_dia1: "", perc_presenca_encontro_presencial: "" });
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
    form.projeto.trim() !== "" &&
    FLOAT_FIELDS.every((f) => form[f] !== "" && !isNaN(parseFloat(form[f])));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="bdd-section-label">
        <span className="bdd-section-label-bar" />
        <span className="bdd-section-label-text">Ultimate — Projeto</span>
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
              <th style={thStyle}>Projeto</th>
              <th style={{ ...thStyle, textAlign: "right" }}>% Presença — Encontros Online Dia 1</th>
              <th style={{ ...thStyle, textAlign: "right" }}>% Presença — Encontro Presencial</th>
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
                  <td style={cellStyle}>{row.projeto}</td>
                  <td style={{ ...cellStyle, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtPerc(row.perc_presenca_encontros_online_dia1)}</td>
                  <td style={{ ...cellStyle, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtPerc(row.perc_presenca_encontro_presencial)}</td>
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

        <div>
          <label style={labelStyle}>Projeto</label>
          <input type="text" className="field-control" placeholder="Nome do projeto" value={form.projeto} onChange={(e) => handleChange("projeto", e.target.value)} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>% Presença — Encontros Online Dia 1</label>
            <input type="number" min={0} max={100} step={0.01} className="field-control" placeholder="0,00" value={form.perc_presenca_encontros_online_dia1} onChange={(e) => handleChange("perc_presenca_encontros_online_dia1", e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>% Presença — Encontro Presencial</label>
            <input type="number" min={0} max={100} step={0.01} className="field-control" placeholder="0,00" value={form.perc_presenca_encontro_presencial} onChange={(e) => handleChange("perc_presenca_encontro_presencial", e.target.value)} />
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
