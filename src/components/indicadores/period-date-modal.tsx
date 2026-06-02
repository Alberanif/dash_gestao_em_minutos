"use client";

import { useState, useEffect } from "react";
import { calcPresetDates, getActivePreset, type PresetKey } from "@/lib/utils/period-presets";

interface PeriodDateModalProps {
  initialStart?: string;
  initialEnd?: string;
  onSave: (start: string, end: string) => void;
  onCancel: () => void;
}

export function PeriodDateModal({
  initialStart = "",
  initialEnd = "",
  onSave,
  onCancel,
}: PeriodDateModalProps) {
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initialEnd);
  const [error, setError] = useState("");

  function todayStr(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }

  const today = todayStr();
  const activePreset: PresetKey | null = getActivePreset(start, end, today);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onCancel]);

  function handleSave() {
    if (!start || !end) {
      setError("Selecione as duas datas.");
      return;
    }
    if (start > end) {
      setError("A data de início deve ser anterior à data de fim.");
      return;
    }
    onSave(start, end);
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-card)",
          padding: 24,
          width: 340,
          display: "flex",
          flexDirection: "column",
          gap: 16,
          boxShadow: "var(--shadow-md)",
        }}
      >
        <p
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: "var(--color-text)",
          }}
        >
          Selecionar período
        </p>

        {/* Preset shortcuts */}
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {(
            [
              { key: "7d", label: "7d" },
              { key: "28d", label: "28d" },
              { key: "90d", label: "90d" },
              { key: "mes-atual", label: "Mês atual" },
              { key: "mes-anterior", label: "Mês anterior" },
            ] as { key: PresetKey; label: string }[]
          ).map(({ key, label }) => {
            const isActive = activePreset === key;
            return (
              <button
                key={key}
                onClick={() => {
                  const { startDate: s, endDate: e } = calcPresetDates(key, today);
                  setStart(s);
                  setEnd(e);
                  setError("");
                }}
                style={{
                  padding: "4px 10px",
                  fontSize: 11,
                  fontWeight: 600,
                  borderRadius: 20,
                  border: isActive
                    ? "1.5px solid var(--color-primary)"
                    : "1.5px solid var(--color-border)",
                  background: isActive
                    ? "var(--color-primary)"
                    : "var(--color-bg)",
                  color: isActive ? "#fff" : "var(--color-text-muted)",
                  cursor: "pointer",
                  transition: "background 0.15s, color 0.15s, border-color 0.15s",
                  whiteSpace: "nowrap",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: "var(--color-text-muted)",
              }}
            >
              Data de início
            </span>
            <input
              type="date"
              className="field-control"
              style={{ fontSize: 13, height: 36 }}
              value={start}
              onChange={(e) => {
                setStart(e.target.value);
                setError("");
              }}
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: "var(--color-text-muted)",
              }}
            >
              Data de fim
            </span>
            <input
              type="date"
              className="field-control"
              style={{ fontSize: 13, height: 36 }}
              value={end}
              onChange={(e) => {
                setEnd(e.target.value);
                setError("");
              }}
            />
          </label>

          {error && (
            <p style={{ fontSize: 12, color: "var(--color-danger)" }}>{error}</p>
          )}
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={onCancel}
            style={{
              padding: "8px 16px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--color-border)",
              background: "none",
              fontSize: 13,
              color: "var(--color-text-muted)",
              cursor: "pointer",
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: "8px 16px",
              borderRadius: "var(--radius-sm)",
              border: "none",
              background: "var(--color-primary)",
              fontSize: 13,
              fontWeight: 600,
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
