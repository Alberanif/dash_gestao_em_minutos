"use client";

import { useEffect, useMemo, useState } from "react";
import { parseBuyers, type ParsedBuyerRow } from "@/lib/ultimates/parse-buyers";

interface UploadBuyersModalProps {
  cycleId: string;
  onCommitted: () => void;
  onCancel: () => void;
}

interface PreviewImpact {
  currentCount: number;
  newCount: number;
  leaving: string[];
  entering: string[];
}

// Modal de carga da base de compradores (PRD issue #114, seção 3.4). DUAS
// entradas equivalentes — arquivo CSV e colagem TSV — alimentam a MESMA função
// pura de parsing (parseBuyers). Fluxo: parse (client) → mode:"preview" (prévia
// de impacto) → confirmação → mode:"commit" → recarrega roster (onCommitted).
// Só é montado para gestor e para ciclos não encerrados (o pai gateia).
export function UploadBuyersModal({ cycleId, onCommitted, onCancel }: UploadBuyersModalProps) {
  const [sourceText, setSourceText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [step, setStep] = useState<"input" | "impact">("input");
  const [impact, setImpact] = useState<PreviewImpact | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showLeaving, setShowLeaving] = useState(false);
  const [showEntering, setShowEntering] = useState(false);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onCancel]);

  const parsed = useMemo(() => parseBuyers(sourceText), [sourceText]);
  const hasContent = sourceText.trim() !== "";
  const canPreview = hasContent && parsed.error === null && parsed.rows.length > 0 && !busy;

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    setSourceText(text);
    setError("");
  }

  async function postBuyers(mode: "preview" | "commit", rows: ParsedBuyerRow[]) {
    return fetch(`/api/ultimates/cycles/${cycleId}/buyers`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode, rows }),
    });
  }

  async function handlePreview() {
    setError("");
    setBusy(true);
    try {
      const res = await postBuyers("preview", parsed.rows);
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Não foi possível gerar a prévia.");
        return;
      }
      setImpact({
        currentCount: data.currentCount ?? 0,
        newCount: data.newCount ?? 0,
        leaving: Array.isArray(data.leaving) ? data.leaving : [],
        entering: Array.isArray(data.entering) ? data.entering : [],
      });
      setStep("impact");
    } catch {
      setError("Falha de rede ao gerar a prévia.");
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm() {
    setError("");
    setBusy(true);
    try {
      const res = await postBuyers("commit", parsed.rows);
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Não foi possível salvar a base.");
        return;
      }
      onCommitted();
    } catch {
      setError("Falha de rede ao salvar a base.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Carregar base de compradores"
      className="ult-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="ult-modal-panel" style={{ maxWidth: 520 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-strong)", margin: 0 }}>
          {step === "input" ? "Carregar base de compradores" : "Confirmar substituição da base"}
        </h3>

        {step === "input" && (
          <>
            <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: 0, lineHeight: 1.5 }}>
              Envie um arquivo CSV ou cole direto da planilha (Google Sheets/Excel). A primeira linha
              deve ser o cabeçalho, com uma coluna de <strong>email</strong> (obrigatória). Colunas
              extras são preservadas.
            </p>

            <div>
              <label className="mb-1 block text-sm font-medium" style={{ color: "var(--color-text-muted)" }}>
                Arquivo CSV
              </label>
              <input
                type="file"
                accept=".csv,.tsv,.txt,text/csv"
                onChange={handleFile}
                data-testid="ultimates-upload-file"
                style={{ fontSize: 13 }}
              />
              {fileName && (
                <p style={{ fontSize: 11, color: "var(--color-text-muted)", margin: "4px 0 0" }}>
                  Arquivo carregado: {fileName}
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium" style={{ color: "var(--color-text-muted)" }}>
                Ou cole da planilha
              </label>
              <textarea
                value={sourceText}
                onChange={(e) => {
                  setSourceText(e.target.value);
                  setFileName(null);
                  setError("");
                }}
                placeholder={"email\tnome\ttelefone\nmaria@ex.com\tMaria\t11999990000"}
                rows={6}
                className="field-control"
                data-testid="ultimates-upload-textarea"
                style={{ fontFamily: "monospace", fontSize: 12, resize: "vertical" }}
              />
            </div>

            {hasContent && parsed.error && (
              <p
                data-testid="ultimates-upload-header-error"
                style={feedbackStyle("var(--color-danger)")}
              >
                {parsed.error}
              </p>
            )}

            {hasContent && !parsed.error && (
              <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: 0 }}>
                <strong>{parsed.rows.length}</strong> linha(s) válida(s) prontas para importar.
              </p>
            )}

            {parsed.invalidRows.length > 0 && (
              <div data-testid="ultimates-upload-invalid" style={feedbackStyle("var(--color-warning)")}>
                <strong>{parsed.invalidRows.length}</strong> linha(s) sem email válido (serão ignoradas):
                <ul style={{ margin: "6px 0 0", paddingLeft: 18, maxHeight: 120, overflowY: "auto" }}>
                  {parsed.invalidRows.slice(0, 50).map((r) => (
                    <li key={`${r.line}-${r.content}`} style={{ fontSize: 11 }}>
                      Linha {r.line}: {r.content} ({r.reason})
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {parsed.duplicates.length > 0 && (
              <p data-testid="ultimates-upload-duplicates" style={feedbackStyle("var(--color-warning)")}>
                <strong>{parsed.duplicates.length}</strong> email(s) duplicado(s) — a última ocorrência
                de cada um foi mantida: {parsed.duplicates.slice(0, 20).join(", ")}
              </p>
            )}

            {error && (
              <p data-testid="ultimates-upload-error" style={feedbackStyle("var(--color-danger)")}>
                {error}
              </p>
            )}

            <div className="ult-modal-actions">
              <button type="button" onClick={onCancel} className="btn-secondary">
                Cancelar
              </button>
              <button
                type="button"
                onClick={handlePreview}
                disabled={!canPreview}
                className="btn-primary"
                data-testid="ultimates-upload-preview-btn"
              >
                {busy ? "Gerando prévia..." : "Pré-visualizar impacto"}
              </button>
            </div>
          </>
        )}

        {step === "impact" && impact && (
          <>
            <p
              data-testid="ultimates-upload-impact"
              style={{ fontSize: 14, color: "var(--color-text)", margin: 0, lineHeight: 1.6 }}
            >
              Você vai substituir <strong>{impact.currentCount}</strong> comprador(es) por{" "}
              <strong>{impact.newCount}</strong> — <strong>{impact.leaving.length}</strong> saem,{" "}
              <strong>{impact.entering.length}</strong> entram.
            </p>

            {impact.leaving.length > 0 && (
              <div>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowLeaving((v) => !v)}
                  data-testid="ultimates-upload-toggle-leaving"
                  style={{ fontSize: 12 }}
                >
                  {showLeaving ? "Ocultar" : "Ver"} quem sai ({impact.leaving.length})
                </button>
                {showLeaving && (
                  <ul style={emailListStyle}>
                    {impact.leaving.map((email) => (
                      <li key={email} style={{ fontSize: 11 }}>{email}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {impact.entering.length > 0 && (
              <div>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowEntering((v) => !v)}
                  data-testid="ultimates-upload-toggle-entering"
                  style={{ fontSize: 12 }}
                >
                  {showEntering ? "Ocultar" : "Ver"} quem entra ({impact.entering.length})
                </button>
                {showEntering && (
                  <ul style={emailListStyle}>
                    {impact.entering.map((email) => (
                      <li key={email} style={{ fontSize: 11 }}>{email}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {error && (
              <p data-testid="ultimates-upload-error" style={feedbackStyle("var(--color-danger)")}>
                {error}
              </p>
            )}

            <div className="ult-modal-actions">
              <button
                type="button"
                onClick={() => {
                  setStep("input");
                  setError("");
                }}
                className="btn-secondary"
                disabled={busy}
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={busy}
                className="btn-primary"
                data-testid="ultimates-upload-confirm-btn"
              >
                {busy ? "Salvando..." : "Confirmar substituição"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const emailListStyle: React.CSSProperties = {
  margin: "6px 0 0",
  paddingLeft: 18,
  maxHeight: 160,
  overflowY: "auto",
};

function feedbackStyle(color: string): React.CSSProperties {
  return {
    fontSize: 12,
    color,
    margin: 0,
    padding: "8px 10px",
    borderRadius: "var(--radius-sm)",
    border: `1px solid color-mix(in srgb, ${color} 35%, transparent)`,
    background: `color-mix(in srgb, ${color} 10%, transparent)`,
    lineHeight: 1.5,
  };
}
