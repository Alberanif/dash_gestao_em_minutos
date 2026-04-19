"use client";

import { useState, useEffect } from "react";
import type { IndicadoresProject } from "@/types/indicadores";

interface ProjectFormData {
  name: string;
  hotmart_product_id: string;
  campaign_terms: string[];
}

interface ProjectFormModalProps {
  project?: IndicadoresProject;
  open: boolean;
  onClose: () => void;
  onSave: (data: ProjectFormData) => Promise<void>;
}

const EMPTY: ProjectFormData = { name: "", hotmart_product_id: "", campaign_terms: [] };

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  fontSize: 13,
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--color-border)",
  background: "var(--color-bg)",
  color: "var(--color-text)",
  outline: "none",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--color-text-muted)",
  marginBottom: 6,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

export function ProjectFormModal({ project, open, onClose, onSave }: ProjectFormModalProps) {
  const [form, setForm] = useState<ProjectFormData>(EMPTY);
  const [termInput, setTermInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setForm(
        project
          ? { name: project.name, hotmart_product_id: project.hotmart_product_id, campaign_terms: project.campaign_terms }
          : EMPTY
      );
      setTermInput("");
      setError("");
    }
  }, [open, project]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  function addTerm() {
    const t = termInput.trim();
    if (!t || form.campaign_terms.includes(t)) return;
    setForm((p) => ({ ...p, campaign_terms: [...p.campaign_terms, t] }));
    setTermInput("");
  }

  function removeTerm(term: string) {
    setForm((p) => ({ ...p, campaign_terms: p.campaign_terms.filter((t) => t !== term) }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) { setError("Nome é obrigatório"); return; }
    if (!form.hotmart_product_id.trim()) { setError("ID/Nome do produto Hotmart é obrigatório"); return; }
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--color-surface)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-md)",
          width: "100%",
          maxWidth: 480,
          padding: 24,
          position: "relative",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <button
          onClick={onClose}
          type="button"
          style={{
            position: "absolute", top: 16, right: 16,
            background: "none", border: "none", cursor: "pointer",
            color: "var(--color-text-muted)", fontSize: 20, lineHeight: 1, padding: 4,
          }}
        >
          ✕
        </button>

        <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--color-text)", marginBottom: 20, paddingRight: 32 }}>
          {project ? "Editar Projeto" : "Novo Projeto"}
        </h2>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <label style={labelStyle}>Nome do projeto</label>
            <input
              style={inputStyle}
              type="text"
              placeholder="Ex: Destrave, Perpétuo, MH"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
          </div>

          <div>
            <label style={labelStyle}>ID / Nome do produto Hotmart</label>
            <input
              style={inputStyle}
              type="text"
              placeholder="Ex: 123456 ou Nome do Produto"
              value={form.hotmart_product_id}
              onChange={(e) => setForm((p) => ({ ...p, hotmart_product_id: e.target.value }))}
            />
          </div>

          <div>
            <label style={labelStyle}>Termos de campanha (Meta Ads)</label>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input
                style={{ ...inputStyle, flex: 1 }}
                type="text"
                placeholder="Termo para buscar campanhas..."
                value={termInput}
                onChange={(e) => setTermInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTerm(); } }}
              />
              <button
                type="button"
                onClick={addTerm}
                disabled={!termInput.trim()}
                style={{
                  padding: "8px 14px", fontSize: 16, fontWeight: 700,
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--color-primary)",
                  background: termInput.trim() ? "var(--color-primary)" : "var(--color-border)",
                  color: termInput.trim() ? "#fff" : "var(--color-text-muted)",
                  cursor: termInput.trim() ? "pointer" : "not-allowed",
                  flexShrink: 0,
                }}
              >
                +
              </button>
            </div>
            {form.campaign_terms.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {form.campaign_terms.map((term) => (
                  <span
                    key={term}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "3px 10px", fontSize: 12, fontWeight: 600,
                      borderRadius: 99,
                      background: "var(--color-primary-light)",
                      color: "var(--color-primary)",
                      border: "1px solid var(--color-primary)",
                    }}
                  >
                    {term}
                    <button
                      type="button"
                      onClick={() => removeTerm(term)}
                      style={{
                        background: "none", border: "none", cursor: "pointer",
                        color: "var(--color-primary)", fontSize: 14, lineHeight: 1, padding: 0,
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {error && <p style={{ fontSize: 13, color: "var(--color-danger)" }}>{error}</p>}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, paddingTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "8px 16px", fontSize: 13,
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--color-border)",
                background: "var(--color-surface)",
                color: "var(--color-text)", cursor: "pointer",
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: "8px 20px", fontSize: 13, fontWeight: 600,
                borderRadius: "var(--radius-sm)", border: "none",
                background: saving ? "var(--color-border)" : "var(--color-primary)",
                color: saving ? "var(--color-text-muted)" : "#fff",
                cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              {saving ? "Salvando..." : project ? "Salvar alterações" : "Criar projeto"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
