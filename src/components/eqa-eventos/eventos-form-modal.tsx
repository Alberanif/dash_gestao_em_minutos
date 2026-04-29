"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { EqaEventosProject, CampaignOption } from "@/types/eqa-eventos";

interface EventosFormData {
  name: string;
  lead_events: string[];
  campaign_terms: string[];
  campaign_ids: string[];
}

interface EventosFormModalProps {
  project?: EqaEventosProject;
  open: boolean;
  onClose: () => void;
  onSave: (data: Omit<EqaEventosProject, "id" | "created_at" | "updated_at">) => Promise<void>;
}

const EMPTY_FORM: EventosFormData = {
  name: "",
  lead_events: [],
  campaign_terms: [],
  campaign_ids: [],
};

function projectToForm(p: EqaEventosProject): EventosFormData {
  return {
    name: p.name,
    lead_events: p.lead_events ?? [],
    campaign_terms: p.campaign_terms ?? [],
    campaign_ids: p.campaign_ids ?? [],
  };
}

export function EventosFormModal({ project, open, onClose, onSave }: EventosFormModalProps) {
  const [form, setForm] = useState<EventosFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [leadEvents, setLeadEvents] = useState<string[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  const [campaignTerms, setCampaignTerms] = useState<string[]>([]);
  const [termInput, setTermInput] = useState("");

  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      setForm(project ? projectToForm(project) : EMPTY_FORM);
      setError("");
      setCampaignTerms(project?.campaign_terms ?? []);
      setTermInput("");
      setCampaigns([]);
    }
  }, [open, project]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    setLoadingEvents(true);
    fetch("/api/eqa-eventos/lead-events")
      .then((r) => r.json())
      .then((data) => setLeadEvents(Array.isArray(data) ? data : []))
      .catch(() => setLeadEvents([]))
      .finally(() => setLoadingEvents(false));
  }, [open]);

  const fetchCampaigns = useCallback((q: string) => {
    setLoadingCampaigns(true);
    fetch(`/api/eqa-eventos/campaigns?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((data) => setCampaigns(Array.isArray(data) ? data : []))
      .catch(() => setCampaigns([]))
      .finally(() => setLoadingCampaigns(false));
  }, []);

  useEffect(() => {
    if (!open || campaignTerms.length === 0) {
      setCampaigns([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const controller = new AbortController();
    setLoadingCampaigns(true);
    const params = new URLSearchParams({
      terms: campaignTerms.join(","),
    });
    fetch(`/api/eqa-eventos/campaigns?${params}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => setCampaigns(Array.isArray(data) ? data : []))
      .catch((err) => { if (err.name !== "AbortError") setCampaigns([]); })
      .finally(() => setLoadingCampaigns(false));
    return () => controller.abort();
  }, [open, campaignTerms]);

  function toggleLeadEvent(event: string) {
    setForm((prev) => ({
      ...prev,
      lead_events: prev.lead_events.includes(event)
        ? prev.lead_events.filter((e) => e !== event)
        : [...prev.lead_events, event],
    }));
  }

  function addTerm() {
    const t = termInput.trim();
    if (!t || campaignTerms.includes(t)) return;
    setCampaignTerms((prev) => [...prev, t]);
    setTermInput("");
  }

  function removeTerm(term: string) {
    setCampaignTerms((prev) => prev.filter((t) => t !== term));
  }

  function toggleCampaignId(cid: string) {
    setForm((prev) => ({
      ...prev,
      campaign_ids: prev.campaign_ids.includes(cid)
        ? prev.campaign_ids.filter((id) => id !== cid)
        : [...prev.campaign_ids, cid],
    }));
  }

  function selectAllCampaigns() {
    const allIds = campaigns.map((c) => c.campaign_id);
    setForm((prev) => ({
      ...prev,
      campaign_ids: [...new Set([...prev.campaign_ids, ...allIds])],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!form.name.trim()) {
      setError("Nome é obrigatório");
      return;
    }

    setSaving(true);
    try {
      await onSave({
        name: form.name.trim(),
        lead_events: form.lead_events,
        campaign_terms: campaignTerms,
        campaign_ids: form.campaign_ids,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar projeto");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

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
        overflowY: "auto",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--color-surface)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-md)",
          width: "100%",
          maxWidth: 520,
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
        >
          ✕
        </button>

        <h2
          style={{
            fontSize: 17,
            fontWeight: 700,
            color: "var(--color-text)",
            marginBottom: 20,
            paddingRight: 32,
          }}
        >
          {project ? "Editar Evento" : "Novo Evento"}
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <label style={labelStyle}>Nome do projeto</label>
            <input
              style={inputStyle}
              type="text"
              placeholder="Ex: Webinar Vendas Abril"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
          </div>

          <div>
            <label style={labelStyle}>
              Eventos de Captação{" "}
              {form.lead_events.length > 0 && (
                <span style={{ color: "var(--color-primary)", fontWeight: 400, textTransform: "none" }}>
                  ({form.lead_events.length} selecionado{form.lead_events.length > 1 ? "s" : ""})
                </span>
              )}
            </label>
            <div
              style={{
                maxHeight: 200,
                overflowY: "auto",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-sm)",
                background: "var(--color-bg)",
              }}
            >
              {loadingEvents ? (
                <p style={{ padding: "10px 12px", fontSize: 12, color: "var(--color-text-muted)" }}>
                  Carregando eventos...
                </p>
              ) : leadEvents.length === 0 ? (
                <p style={{ padding: "10px 12px", fontSize: 12, color: "var(--color-text-muted)" }}>
                  Nenhum evento disponível
                </p>
              ) : (
                leadEvents.map((event) => {
                  const checked = form.lead_events.includes(event);
                  return (
                    <label
                      key={event}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "8px 12px",
                        cursor: "pointer",
                        background: checked ? "var(--color-primary-light)" : "transparent",
                        borderBottom: "1px solid var(--color-border)",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleLeadEvent(event)}
                        style={{ accentColor: "var(--color-primary)", flexShrink: 0 }}
                      />
                      <span style={{ fontSize: 13, color: "var(--color-text)" }}>
                        {event}
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          <div>
            <label style={labelStyle}>
              Termos de Busca Meta Ads{" "}
              {campaignTerms.length > 0 && (
                <span style={{ color: "var(--color-primary)", fontWeight: 400, textTransform: "none" }}>
                  ({campaignTerms.length} termo{campaignTerms.length > 1 ? "s" : ""})
                </span>
              )}
            </label>
            <div style={{ marginBottom: 8 }}>
              <input
                style={{ ...inputStyle, marginBottom: 8 }}
                type="text"
                placeholder="Digite um termo e pressione Enter..."
                value={termInput}
                onChange={(e) => setTermInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTerm();
                  }
                }}
              />
              {campaignTerms.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                  {campaignTerms.map((term) => (
                    <div
                      key={term}
                      style={{
                        background: "var(--color-primary)",
                        color: "#fff",
                        padding: "4px 10px",
                        borderRadius: "var(--radius-sm)",
                        fontSize: 12,
                        fontWeight: 500,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      {term}
                      <button
                        type="button"
                        onClick={() => removeTerm(term)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#fff",
                          cursor: "pointer",
                          padding: 0,
                          fontSize: 16,
                          lineHeight: 1,
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {campaignTerms.length > 0 && (
            <div>
              <label style={labelStyle}>
                Campanhas encontradas{" "}
                {form.campaign_ids.length > 0 && (
                  <span style={{ color: "var(--color-primary)", fontWeight: 400, textTransform: "none" }}>
                    ({form.campaign_ids.length} selecionada{form.campaign_ids.length > 1 ? "s" : ""})
                  </span>
                )}
              </label>
              <div
                style={{
                  maxHeight: 200,
                  overflowY: "auto",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--color-bg)",
                  marginBottom: 8,
                }}
              >
                {loadingCampaigns ? (
                  <p style={{ padding: "10px 12px", fontSize: 12, color: "var(--color-text-muted)" }}>
                    Buscando campanhas...
                  </p>
                ) : campaigns.length === 0 ? (
                  <p style={{ padding: "10px 12px", fontSize: 12, color: "var(--color-text-muted)" }}>
                    Nenhuma campanha encontrada para esses termos
                  </p>
                ) : (
                  campaigns.map((camp) => {
                    const checked = form.campaign_ids.includes(camp.campaign_id);
                    return (
                      <label
                        key={camp.campaign_id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "8px 12px",
                          cursor: "pointer",
                          background: checked ? "var(--color-primary-light)" : "transparent",
                          borderBottom: "1px solid var(--color-border)",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCampaignId(camp.campaign_id)}
                          style={{ accentColor: "var(--color-primary)", flexShrink: 0 }}
                        />
                        <span
                          style={{
                            fontSize: 13,
                            color: "var(--color-text)",
                            fontWeight: checked ? 600 : 400,
                          }}
                        >
                          {camp.campaign_name}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
              {campaigns.length > 0 && form.campaign_ids.length < campaigns.length && (
                <button
                  type="button"
                  onClick={selectAllCampaigns}
                  style={{
                    fontSize: 12,
                    color: "var(--color-primary)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    textDecoration: "underline",
                    padding: 0,
                  }}
                >
                  Selecionar todas
                </button>
              )}
            </div>
          )}

          {error && (
            <p style={{ fontSize: 13, color: "var(--color-danger)" }}>
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              style={{
                flex: 1,
                padding: "10px 16px",
                fontSize: 13,
                fontWeight: 600,
                borderRadius: "var(--radius-sm)",
                border: "none",
                background: "var(--color-primary)",
                color: "#fff",
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? "Salvando..." : project ? "Atualizar" : "Criar"}
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: "10px 16px",
                fontSize: 13,
                fontWeight: 600,
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--color-border)",
                background: "var(--color-bg)",
                color: "var(--color-text)",
                cursor: "pointer",
              }}
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
