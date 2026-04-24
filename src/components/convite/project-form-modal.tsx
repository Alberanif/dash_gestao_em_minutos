"use client";

import { useEffect, useState } from "react";
import { CONVITE_GROUP_OPTIONS, type ConviteGroup } from "@/types/convite";

interface ConviteProjectFormData {
  grupo: ConviteGroup;
  nome_projeto: string;
  data_inicio: string;
  data_fim: string;
}

interface ConviteProjectFormModalProps {
  open: boolean;
  initialGroup?: ConviteGroup;
  onClose: () => void;
  onSave: (data: ConviteProjectFormData) => Promise<void>;
}

const EMPTY_FORM: ConviteProjectFormData = {
  grupo: "funil_destrave",
  nome_projeto: "",
  data_inicio: "",
  data_fim: "",
};

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

export function ConviteProjectFormModal({
  open,
  initialGroup = "funil_destrave",
  onClose,
  onSave,
}: ConviteProjectFormModalProps) {
  const [form, setForm] = useState<ConviteProjectFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setForm({ ...EMPTY_FORM, grupo: initialGroup });
      setSaving(false);
      setError("");
    }
  }, [open, initialGroup]);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    if (open) {
      document.addEventListener("keydown", handleKey);
    }

    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!form.nome_projeto.trim()) {
      setError("Nome do projeto é obrigatório");
      return;
    }

    if (!form.data_inicio || !form.data_fim) {
      setError("Período do projeto é obrigatório");
      return;
    }

    if (form.data_fim <= form.data_inicio) {
      setError("A data de fim deve ser posterior à data de início");
      return;
    }

    setSaving(true);
    try {
      await onSave({
        grupo: form.grupo,
        nome_projeto: form.nome_projeto.trim(),
        data_inicio: form.data_inicio,
        data_fim: form.data_fim,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar projeto");
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
        onClick={(event) => event.stopPropagation()}
        style={{
          background: "var(--color-surface)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-md)",
          width: "100%",
          maxWidth: 460,
          padding: 24,
          position: "relative",
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--color-text-muted)",
            fontSize: 20,
            lineHeight: 1,
            padding: 4,
          }}
          title="Fechar"
        >
          ✕
        </button>

        <h2
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 700,
            color: "var(--color-text)",
            paddingRight: 32,
          }}
        >
          Novo projeto de Convite
        </h2>
        <p
          style={{
            margin: "6px 0 20px",
            fontSize: 13,
            color: "var(--color-text-muted)",
          }}
        >
          Cadastre o projeto para conectar a visualização do funil com os dados da base.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={labelStyle}>Grupo</label>
            <select
              value={form.grupo}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  grupo: event.target.value as ConviteGroup,
                }))
              }
              style={inputStyle}
            >
              {CONVITE_GROUP_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Nome do Projeto</label>
            <input
              type="text"
              value={form.nome_projeto}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, nome_projeto: event.target.value }))
              }
              style={inputStyle}
              placeholder="Ex.: Aniversário Fora da Média"
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12,
            }}
          >
            <div>
              <label style={labelStyle}>Data de Início</label>
              <input
                type="date"
                value={form.data_inicio}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, data_inicio: event.target.value }))
                }
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Data de Fim</label>
              <input
                type="date"
                value={form.data_fim}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, data_fim: event.target.value }))
                }
                style={inputStyle}
              />
            </div>
          </div>

          {error && (
            <div
              style={{
                borderRadius: "var(--radius-sm)",
                border: "1px solid color-mix(in srgb, var(--color-danger) 22%, transparent)",
                background: "color-mix(in srgb, var(--color-danger) 8%, transparent)",
                color: "var(--color-danger)",
                fontSize: 13,
                padding: "10px 12px",
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "8px 14px",
                fontSize: 13,
                fontWeight: 600,
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--color-border)",
                background: "var(--color-surface)",
                color: "var(--color-text)",
                cursor: "pointer",
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: "8px 16px",
                fontSize: 13,
                fontWeight: 600,
                borderRadius: "var(--radius-sm)",
                border: "none",
                background: "var(--color-primary)",
                color: "#fff",
                cursor: saving ? "wait" : "pointer",
                opacity: saving ? 0.85 : 1,
              }}
            >
              {saving ? "Salvando..." : "Salvar projeto"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
