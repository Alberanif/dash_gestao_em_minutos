"use client";

import { useEffect, useState } from "react";
import type { FunilDestraveRow } from "@/types/base-de-dados";
import type { ConviteProjectOption } from "@/types/convite";
import { labelStyle, cellStyle, thStyle } from "./_styles";

const fmtFloat = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2 });

const FLOAT_FIELDS = ["conv_produto_principal", "conv_downsell", "conv_upsell", "cac_geral"] as const;

export default function FunilDestrave() {
  const [rows, setRows] = useState<FunilDestraveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectOptions, setProjectOptions] = useState<ConviteProjectOption[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
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
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/base-de-dados/convite/funil-destrave")
      .then((r) => r.json())
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch("/api/convite/project-options?group=funil_destrave")
      .then((r) => r.json())
      .then((data) => setProjectOptions(Array.isArray(data) ? data : []))
      .catch(() => setProjectOptions([]))
      .finally(() => setLoadingProjects(false));
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
      const savedRow: FunilDestraveRow = await res.json();
      setRows((prev) => [savedRow, ...prev]);
      setForm({ projeto: "", comparecimento: "", conv_produto_principal: "", conv_downsell: "", conv_upsell: "", cac_geral: "" });
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
    !loadingProjects &&
    projectOptions.length > 0 &&
    form.projeto.trim() !== "" &&
    form.comparecimento !== "" &&
    !isNaN(parseInt(form.comparecimento, 10)) &&
    FLOAT_FIELDS.every((f) => form[f] !== "" && !isNaN(parseFloat(form[f])));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="bdd-section-label">
        <span className="bdd-section-label-bar" />
        <span className="bdd-section-label-text">Métricas Funil Destrave</span>
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
                <td colSpan={6} style={{ ...cellStyle, textAlign: "center", color: "var(--color-text-muted)", padding: "32px 16px" }}>
                  Nenhum registro ainda. Adicione o primeiro abaixo.
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

      <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-card)", padding: "20px", display: "flex", flexDirection: "column", gap: 16 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>
          Novo registro
        </p>

        <div>
          <label style={labelStyle}>Projeto</label>
          <select
            className="field-control"
            value={form.projeto}
            disabled={loadingProjects || projectOptions.length === 0}
            onChange={(e) => handleChange("projeto", e.target.value)}
          >
            <option value="">
              {loadingProjects
                ? "Carregando projetos..."
                : projectOptions.length === 0
                  ? "Nenhum projeto do Funil Destrave disponível"
                  : "Selecione um projeto"}
            </option>
            {projectOptions.map((option) => (
              <option key={option.id} value={option.nome_projeto}>
                {option.nome_projeto}
              </option>
            ))}
          </select>
          {!loadingProjects && projectOptions.length === 0 && (
            <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--color-text-muted)" }}>
              Crie primeiro um projeto em Convite &gt; Funil Destrave para liberar o cadastro das métricas.
            </p>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>Comparecimento</label>
            <input type="number" min={0} step={1} className="field-control" placeholder="0" value={form.comparecimento} onChange={(e) => handleChange("comparecimento", e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Conv. Produto Principal</label>
            <input type="number" min={0} step={0.01} className="field-control" placeholder="0,00" value={form.conv_produto_principal} onChange={(e) => handleChange("conv_produto_principal", e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Conv. Downsell</label>
            <input type="number" min={0} step={0.01} className="field-control" placeholder="0,00" value={form.conv_downsell} onChange={(e) => handleChange("conv_downsell", e.target.value)} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>Conv. Upsell</label>
            <input type="number" min={0} step={0.01} className="field-control" placeholder="0,00" value={form.conv_upsell} onChange={(e) => handleChange("conv_upsell", e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>CAC Geral</label>
            <input type="number" min={0} step={0.01} className="field-control" placeholder="0,00" value={form.cac_geral} onChange={(e) => handleChange("cac_geral", e.target.value)} />
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
