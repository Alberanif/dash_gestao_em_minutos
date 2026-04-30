"use client";

import { useEffect, useState } from "react";
import type { EntregaNivelAMccFccProjetoRow } from "@/types/entrega-nivel-a";
import { ProjectPickerModal } from "./project-picker-modal";

const fmtFloat = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
const fmtPerc = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) + "%";

function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "var(--color-bg)", borderRadius: "var(--radius-sm)", padding: "10px 12px" }}>
      <p style={{ margin: 0, fontSize: 11, color: "var(--color-text-muted)" }}>{label}</p>
      <p style={{ margin: "4px 0 0", fontSize: 14, fontWeight: 700, color: "var(--color-text)" }}>
        {value}
      </p>
    </div>
  );
}

export function MccFccProjetoSection() {
  const [rows, setRows] = useState<EntregaNivelAMccFccProjetoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProjetos, setSelectedProjetos] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    fetch("/api/base-de-dados/entrega-nivel-a/mcc-fcc-projeto")
      .then((r) => r.json())
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("ena-projeto-mcc-fcc");
    if (stored) {
      setSelectedProjetos(JSON.parse(stored));
    }
  }, []);

  function handleSelectProject(projeto: string) {
    const updated = [...selectedProjetos, projeto];
    setSelectedProjetos(updated);
    localStorage.setItem("ena-projeto-mcc-fcc", JSON.stringify(updated));
  }

  function handleRemoveProject(projeto: string) {
    const updated = selectedProjetos.filter((p) => p !== projeto);
    setSelectedProjetos(updated);
    localStorage.setItem("ena-projeto-mcc-fcc", JSON.stringify(updated));
  }

  const availableProjetos = Array.from(new Set(rows.map((r) => r.projeto))).sort();
  const dataMap = new Map(rows.map((r) => [r.projeto, r]));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--color-text)" }}>
            MCC e FCC — Projeto
          </h2>
        </div>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--color-text-muted)",
            background: "var(--color-bg)",
            border: "1px solid var(--color-border)",
            borderRadius: 99,
            padding: "2px 10px",
          }}
        >
          {selectedProjetos.length} {selectedProjetos.length === 1 ? "projeto" : "projetos"}
        </span>
        <button
          onClick={() => setPickerOpen(true)}
          disabled={loading || availableProjetos.length === selectedProjetos.length}
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            border: "none",
            background: loading || availableProjetos.length === selectedProjetos.length ? "var(--color-border)" : "var(--color-primary)",
            color: "#fff",
            cursor: loading || availableProjetos.length === selectedProjetos.length ? "not-allowed" : "pointer",
            fontSize: 20,
            fontWeight: 500,
            lineHeight: 1,
            opacity: loading || availableProjetos.length === selectedProjetos.length ? 0.5 : 1,
          }}
          title="Adicionar projeto"
        >
          +
        </button>
      </div>

      {selectedProjetos.length === 0 ? (
        <div
          style={{
            background: "var(--color-surface)",
            border: "1px dashed var(--color-border)",
            borderRadius: "var(--radius-card)",
            padding: "28px 24px",
            textAlign: "center",
          }}
        >
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--color-text)" }}>
            Nenhum projeto selecionado
          </p>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
            Clique no botão "+" para selecionar um projeto e visualizar os dados.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 16,
          }}
        >
          {selectedProjetos.map((projeto) => {
            const data = dataMap.get(projeto);
            return (
              <div
                key={projeto}
                style={{
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-card)",
                  padding: "16px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--color-text)" }}>
                    {projeto}
                  </p>
                  <button
                    onClick={() => handleRemoveProject(projeto)}
                    style={{
                      background: "transparent",
                      border: "none",
                      fontSize: 18,
                      color: "var(--color-text-muted)",
                      cursor: "pointer",
                      padding: 0,
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                </div>

                {data ? (
                  <>
                    <div style={{ height: 1, background: "var(--color-border)", margin: "12px 0" }} />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <MetricCell label="NPS" value={fmtFloat(data.nps)} />
                      <MetricCell label="No Show — Geral" value={fmtPerc(data.no_show_geral)} />
                    </div>
                  </>
                ) : (
                  <p style={{ margin: "12px 0", fontSize: 13, color: "var(--color-text-muted)" }}>
                    Nenhum dado encontrado
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ProjectPickerModal
        open={pickerOpen}
        projects={availableProjetos}
        selected={selectedProjetos}
        onSelect={handleSelectProject}
        onClose={() => setPickerOpen(false)}
      />
    </div>
  );
}
