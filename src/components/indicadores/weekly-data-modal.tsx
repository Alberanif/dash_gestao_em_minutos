"use client";

import { useState, useEffect } from "react";
import type { IndicadoresWeeklyData } from "@/types/indicadores";

interface WeeklyDataModalProps {
  projectId: string;
  weekStart: string;
  weekEnd: string;
  existing: IndicadoresWeeklyData | null;
  open: boolean;
  onClose: () => void;
  onSave: (data: IndicadoresWeeklyData) => void;
}

type FormFields = {
  meta_connect_rate: string;
  meta_lp_conversion: string;
  meta_cpl_traffic: string;
  google_spend: string;
  google_cpm: string;
  google_leads: string;
  google_connect_rate: string;
  google_cpl_traffic: string;
  google_lp_conversion: string;
};

const EMPTY_FORM: FormFields = {
  meta_connect_rate: "",
  meta_lp_conversion: "",
  meta_cpl_traffic: "",
  google_spend: "",
  google_cpm: "",
  google_leads: "",
  google_connect_rate: "",
  google_cpl_traffic: "",
  google_lp_conversion: "",
};

function toStr(v: number | null | undefined): string {
  return v !== null && v !== undefined ? String(v) : "";
}

function toNum(s: string): number | null {
  const n = parseFloat(s.replace(",", "."));
  return isNaN(n) ? null : n;
}

function formatWeek(start: string, end: string): string {
  const [sy, sm, sd] = start.split("-");
  const [, em, ed] = end.split("-");
  return `${sd}/${sm}/${sy} a ${ed}/${em}`;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "7px 10px",
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
  fontSize: 11,
  fontWeight: 600,
  color: "var(--color-text-muted)",
  marginBottom: 4,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: "var(--color-text)",
  marginBottom: 12,
  marginTop: 4,
};

export function WeeklyDataModal({
  projectId,
  weekStart,
  weekEnd,
  existing,
  open,
  onClose,
  onSave,
}: WeeklyDataModalProps) {
  const [form, setForm] = useState<FormFields>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setForm(
        existing
          ? {
              meta_connect_rate: toStr(existing.meta_connect_rate),
              meta_lp_conversion: toStr(existing.meta_lp_conversion),
              meta_cpl_traffic: toStr(existing.meta_cpl_traffic),
              google_spend: toStr(existing.google_spend),
              google_cpm: toStr(existing.google_cpm),
              google_leads: toStr(existing.google_leads),
              google_connect_rate: toStr(existing.google_connect_rate),
              google_cpl_traffic: toStr(existing.google_cpl_traffic),
              google_lp_conversion: toStr(existing.google_lp_conversion),
            }
          : EMPTY_FORM
      );
      setError("");
    }
  }, [open, existing]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  function field(key: keyof FormFields, label: string) {
    return (
      <div>
        <label style={labelStyle}>{label}</label>
        <input
          style={inputStyle}
          type="text"
          inputMode="decimal"
          placeholder="—"
          value={form[key]}
          onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
        />
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const body = {
        week_start: weekStart,
        week_end: weekEnd,
        meta_connect_rate: toNum(form.meta_connect_rate),
        meta_lp_conversion: toNum(form.meta_lp_conversion),
        meta_cpl_traffic: toNum(form.meta_cpl_traffic),
        google_spend: toNum(form.google_spend),
        google_cpm: toNum(form.google_cpm),
        google_leads: toNum(form.google_leads),
        google_connect_rate: toNum(form.google_connect_rate),
        google_cpl_traffic: toNum(form.google_cpl_traffic),
        google_lp_conversion: toNum(form.google_lp_conversion),
      };
      const res = await fetch(`/api/indicadores/projects/${projectId}/weekly`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Erro ao salvar");
      }
      const saved = await res.json();
      onSave(saved);
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
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.45)", zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16, overflowY: "auto",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--color-surface)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-md)",
          width: "100%", maxWidth: 520,
          padding: 24, position: "relative",
          maxHeight: "90vh", overflowY: "auto",
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

        <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text)", marginBottom: 4, paddingRight: 32 }}>
          Dados da semana
        </h2>
        <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginBottom: 20 }}>
          {formatWeek(weekStart, weekEnd)}
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              padding: 16,
              borderRadius: "var(--radius-card)",
              border: "1px solid var(--color-border)",
              background: "var(--color-bg)",
            }}
          >
            <p style={sectionTitleStyle}>Meta Ads — campos manuais</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              {field("meta_connect_rate", "Connect Rate (%)")}
              {field("meta_lp_conversion", "Conversão LP (%)")}
              {field("meta_cpl_traffic", "CPL Tráfego (R$)")}
            </div>
          </div>

          <div
            style={{
              padding: 16,
              borderRadius: "var(--radius-card)",
              border: "1px solid var(--color-border)",
              background: "var(--color-bg)",
            }}
          >
            <p style={sectionTitleStyle}>Google Ads</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              {field("google_spend", "Investimento (R$)")}
              {field("google_cpm", "CPM (R$)")}
              {field("google_leads", "Leads")}
              {field("google_connect_rate", "Connect Rate (%)")}
              {field("google_cpl_traffic", "CPL Tráfego (R$)")}
              {field("google_lp_conversion", "Conversão LP (%)")}
            </div>
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
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
