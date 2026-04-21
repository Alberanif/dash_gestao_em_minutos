"use client";

import { useState } from "react";

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
        zIndex: 1000,
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
            <p style={{ fontSize: 12, color: "#ef4444" }}>{error}</p>
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
