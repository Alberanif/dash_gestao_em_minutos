"use client";

import { useEffect, useState } from "react";
import type { FunilDestraveRow } from "@/types/base-de-dados";
import { inputStyle, labelStyle, cellStyle, thStyle } from "./_styles";

const fmtFloat = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2 });

const FLOAT_FIELDS = ["conv_produto_principal", "conv_downsell", "conv_upsell", "cac_geral"] as const;

export default function FunilDestrave() {
  const [rows, setRows] = useState<FunilDestraveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    projeto: "",
    comparecimento: "",
    conv_produto_principal: "",
    conv_downsell: "",
    conv_upsell: "",
    cac_geral: "",
  });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/base-de-dados/convite/funil-destrave")
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
      const res = await fetch("/api/base-de-dados/convite/funil-destrave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projeto: form.projeto,
          comparecimento: parseInt(form.comparecimento, 10),
          conv_produto_principal: parseFloat(form.conv_produto_principal),
          conv_downsell: parseFloat(form.conv_downsell),
          conv_upsell: parseFloat(form.conv_upsell),
          cac_geral: parseFloat(form.cac_geral),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Erro ao salvar");
      }
      const saved: FunilDestraveRow = await res.json();
      setRows((prev) => [saved, ...prev]);
      setForm({ projeto: "", comparecimento: "", conv_produto_principal: "", conv_downsell: "", conv_upsell: "", cac_geral: "" });
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
    form.comparecimento !== "" &&
    !isNaN(parseInt(form.comparecimento, 10)) &&
    FLOAT_FIELDS.every((f) => form[f] !== "" && !isNaN(parseFloat(form[f])));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <p style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>
        Métricas Funil Destrave
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
              <th style={{ ...thStyle, textAlign: "right" }}>Comparec.</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Conv. PP</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Conv. Down</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Conv. Up</th>
              <th style={{ ...thStyle, textAlign: "right" }}>CAC Geral</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [0, 1, 2].map((i) => (
                <tr key={i} style={{ borderTop: "1px solid var(--color-border)" }}>
                  {[0, 1, 2, 3, 4, 5].map((j) => (
                    <td key={j} style={cellStyle}>
                      <div style={{ height: 14, width: j === 0 ? "60%" : 40, borderRadius: 4, background: "var(--color-bg)", animation: "pulse 1.5s ease-in-out infinite", marginLeft: j === 0 ? undefined : "auto" }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ ...cellStyle, textAlign: "center", color: "var(--color-text-muted)", padding: "24px 16px" }}>
                  Nenhum registro ainda
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} style={{ borderTop: "1px solid var(--color-border)" }}>
                  <td style={cellStyle}>{row.projeto}</td>
                  <td style={{ ...cellStyle, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{row.comparecimento.toLocaleString("pt-BR")}</td>
                  <td style={{ ...cellStyle, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtFloat(row.conv_produto_principal)}</td>
                  <td style={{ ...cellStyle, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtFloat(row.conv_downsell)}</td>
                  <td style={{ ...cellStyle, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtFloat(row.conv_upsell)}</td>
                  <td style={{ ...cellStyle, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtFloat(row.cac_geral)}</td>
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

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>Comparecimento</label>
            <input type="number" min={0} step={1} style={inputStyle} placeholder="0" value={form.comparecimento} onChange={(e) => handleChange("comparecimento", e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Conv. Produto Principal</label>
            <input type="number" min={0} step={0.01} style={inputStyle} placeholder="0,00" value={form.conv_produto_principal} onChange={(e) => handleChange("conv_produto_principal", e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Conv. Downsell</label>
            <input type="number" min={0} step={0.01} style={inputStyle} placeholder="0,00" value={form.conv_downsell} onChange={(e) => handleChange("conv_downsell", e.target.value)} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>Conv. Upsell</label>
            <input type="number" min={0} step={0.01} style={inputStyle} placeholder="0,00" value={form.conv_upsell} onChange={(e) => handleChange("conv_upsell", e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>CAC Geral</label>
            <input type="number" min={0} step={0.01} style={inputStyle} placeholder="0,00" value={form.cac_geral} onChange={(e) => handleChange("cac_geral", e.target.value)} />
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
