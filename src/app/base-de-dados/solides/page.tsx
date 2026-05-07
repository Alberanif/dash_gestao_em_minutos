"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import type { LtvSolidesEntry } from "@/types/ltv";

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--color-text-muted)",
  marginBottom: 4,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  fontSize: 13,
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
  color: "var(--color-text)",
  boxSizing: "border-box",
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

const cellStyle: React.CSSProperties = {
  padding: "11px 16px",
  fontSize: 13,
  color: "var(--color-text)",
};

type FormData = {
  period_start: string;
  period_end: string;
  assinaturas_ativas: string;
  assinaturas_canceladas: string;
  novas_assinaturas: string;
};

const emptyForm: FormData = {
  period_start: "",
  period_end: "",
  assinaturas_ativas: "",
  assinaturas_canceladas: "",
  novas_assinaturas: "",
};

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

export default function SolidesPage() {
  const [rows, setRows] = useState<LtvSolidesEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<LtvSolidesEntry | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ltv/solides");
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setFormOpen(true);
  }

  function openEdit(row: LtvSolidesEntry) {
    setEditing(row);
    setForm({
      period_start: row.period_start,
      period_end: row.period_end,
      assinaturas_ativas: String(row.assinaturas_ativas),
      assinaturas_canceladas: String(row.assinaturas_canceladas),
      novas_assinaturas: String(row.novas_assinaturas),
    });
    setError("");
    setFormOpen(true);
  }

  async function handleDelete(row: LtvSolidesEntry) {
    if (!confirm(`Excluir o registro do período ${formatDate(row.period_start)} → ${formatDate(row.period_end)}?`)) return;
    await fetch(`/api/ltv/solides/${row.id}`, { method: "DELETE" });
    setRows((prev) => prev.filter((r) => r.id !== row.id));
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const payload = {
        period_start: form.period_start,
        period_end: form.period_end,
        assinaturas_ativas: parseInt(form.assinaturas_ativas) || 0,
        assinaturas_canceladas: parseInt(form.assinaturas_canceladas) || 0,
        novas_assinaturas: parseInt(form.novas_assinaturas) || 0,
      };

      const method = editing ? "PUT" : "POST";
      const url = editing ? `/api/ltv/solides/${editing.id}` : "/api/ltv/solides";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Erro ao salvar");
      }

      await loadRows();
      setFormOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  const canSave =
    !saving &&
    form.period_start !== "" &&
    form.period_end !== "" &&
    form.period_start <= form.period_end;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 0 40px" }}>
      <header className="bdd-page-header">
        <Link href="/base-de-dados" className="bdd-back-link">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Voltar
        </Link>
        <span style={{ color: "var(--color-border)", fontSize: 18, userSelect: "none" }}>/</span>
        <h1 className="bdd-page-title">Solides</h1>
      </header>

      <div style={{ padding: "32px 24px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div className="bdd-section-label" style={{ margin: 0 }}>
            <span className="bdd-section-label-bar" />
            <span className="bdd-section-label-text">Registros de assinaturas</span>
          </div>
          <button
            onClick={openCreate}
            style={{
              padding: "8px 18px",
              fontSize: 13,
              fontWeight: 600,
              borderRadius: "var(--radius-sm)",
              border: "none",
              background: "var(--color-primary)",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            + Novo Registro
          </button>
        </div>

        {/* Modal de criação/edição */}
        {formOpen && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.35)",
              zIndex: 50,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
            }}
            onClick={(e) => { if (e.target === e.currentTarget) setFormOpen(false); }}
          >
            <div
              style={{
                background: "var(--color-surface)",
                borderRadius: "var(--radius-card)",
                boxShadow: "var(--shadow-md)",
                padding: 28,
                width: "100%",
                maxWidth: 480,
              }}
            >
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, color: "var(--color-text)" }}>
                {editing ? "Editar Registro" : "Novo Registro"}
              </h2>

              <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Período início</label>
                  <input
                    type="date"
                    value={form.period_start}
                    onChange={(e) => setForm((f) => ({ ...f, period_start: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Período fim</label>
                  <input
                    type="date"
                    value={form.period_end}
                    onChange={(e) => setForm((f) => ({ ...f, period_end: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Assinaturas Ativas</label>
                <input
                  type="number"
                  min={0}
                  value={form.assinaturas_ativas}
                  onChange={(e) => setForm((f) => ({ ...f, assinaturas_ativas: e.target.value }))}
                  style={inputStyle}
                  placeholder="0"
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Assinaturas Canceladas</label>
                <input
                  type="number"
                  min={0}
                  value={form.assinaturas_canceladas}
                  onChange={(e) => setForm((f) => ({ ...f, assinaturas_canceladas: e.target.value }))}
                  style={inputStyle}
                  placeholder="0"
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>Novas Assinaturas</label>
                <input
                  type="number"
                  min={0}
                  value={form.novas_assinaturas}
                  onChange={(e) => setForm((f) => ({ ...f, novas_assinaturas: e.target.value }))}
                  style={inputStyle}
                  placeholder="0"
                />
              </div>

              {error && (
                <p style={{ fontSize: 13, color: "var(--color-danger)", marginBottom: 14 }}>{error}</p>
              )}

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button
                  onClick={() => setFormOpen(false)}
                  style={{
                    padding: "8px 18px",
                    fontSize: 13,
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--color-border)",
                    background: "none",
                    color: "var(--color-text)",
                    cursor: "pointer",
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={!canSave}
                  style={{
                    padding: "8px 18px",
                    fontSize: 13,
                    fontWeight: 600,
                    borderRadius: "var(--radius-sm)",
                    border: "none",
                    background: canSave ? "var(--color-primary)" : "var(--color-border)",
                    color: "#fff",
                    cursor: canSave ? "pointer" : "not-allowed",
                  }}
                >
                  {saving ? "Salvando…" : "Salvar"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tabela de registros */}
        {loading ? (
          <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>Carregando…</p>
        ) : rows.length === 0 ? (
          <div
            style={{
              border: "2px dashed var(--color-border)",
              borderRadius: "var(--radius-card)",
              padding: "40px 24px",
              textAlign: "center",
            }}
          >
            <p style={{ fontSize: 14, color: "var(--color-text-muted)" }}>
              Nenhum registro ainda. Clique em &quot;Novo Registro&quot; para começar.
            </p>
          </div>
        ) : (
          <div
            style={{
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-card)",
              overflow: "hidden",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--color-bg)", borderBottom: "1px solid var(--color-border)" }}>
                  <th style={thStyle}>Período</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Ativas</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Canceladas</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Novas</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr
                    key={row.id}
                    style={{
                      borderBottom: i < rows.length - 1 ? "1px solid var(--color-border)" : "none",
                      background: "var(--color-surface)",
                    }}
                  >
                    <td style={cellStyle}>
                      {formatDate(row.period_start)} → {formatDate(row.period_end)}
                    </td>
                    <td style={{ ...cellStyle, textAlign: "right", fontWeight: 600 }}>
                      {row.assinaturas_ativas}
                    </td>
                    <td style={{ ...cellStyle, textAlign: "right" }}>
                      {row.assinaturas_canceladas}
                    </td>
                    <td style={{ ...cellStyle, textAlign: "right" }}>
                      {row.novas_assinaturas}
                    </td>
                    <td style={{ ...cellStyle, textAlign: "right" }}>
                      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                        <button
                          onClick={() => openEdit(row)}
                          style={{
                            fontSize: 12,
                            padding: "4px 12px",
                            borderRadius: "var(--radius-sm)",
                            border: "1px solid var(--color-border)",
                            background: "none",
                            color: "var(--color-text)",
                            cursor: "pointer",
                          }}
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDelete(row)}
                          style={{
                            fontSize: 12,
                            padding: "4px 12px",
                            borderRadius: "var(--radius-sm)",
                            border: "1px solid var(--color-border)",
                            background: "none",
                            color: "var(--color-danger)",
                            cursor: "pointer",
                          }}
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
