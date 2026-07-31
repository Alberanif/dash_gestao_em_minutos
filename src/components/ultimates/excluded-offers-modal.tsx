"use client";

import { useCallback, useEffect, useState } from "react";
import type { UltimatesOfferOption } from "@/types/ultimates";
import { fmtDateFull } from "@/lib/ultimates/format";
import type { ExcludedOffer } from "./types";

interface ExcludedOffersModalProps {
  cycleId: string;
  // gestor gerencia; analista só lê (espelha o gate real dos endpoints).
  canWrite: boolean;
  // Disparado após cada escrita bem-sucedida — o pai recarrega o dashboard e
  // o contador do botão.
  onChanged: () => void;
  onClose: () => void;
}

// Modal "Ofertas excluídas" (PRD docs/PRD_2026-07-30_ultimates_excluir_ofertas.md,
// seção 3.2). Gerencia a lista de ofertas cujas compras não contam para o
// ciclo — tipicamente compras de teste/internas.
//
// A oferta é escolhida numa lista das ofertas REAIS do produto (com o número
// de vendas de cada uma), nunca digitada: um código com typo não excluiria
// nada e falharia em silêncio justamente no número que o gestor está tentando
// corrigir.
//
// Nada aqui apaga venda: as RPCs de leitura descartam as vendas da oferta na
// hora de classificar (migration 052). Por isso remover uma linha devolve as
// vendas à contabilidade na leitura seguinte, sem refresh.
export function ExcludedOffersModal({
  cycleId,
  canWrite,
  onChanged,
  onClose,
}: ExcludedOffersModalProps) {
  const [offers, setOffers] = useState<ExcludedOffer[] | null>(null);
  const [options, setOptions] = useState<UltimatesOfferOption[]>([]);
  const [selected, setSelected] = useState("");
  const [search, setSearch] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const [listRes, optionsRes] = await Promise.all([
        fetch(`/api/ultimates/cycles/${cycleId}/excluded-offers`),
        fetch(`/api/ultimates/cycles/${cycleId}/offer-options`),
      ]);
      if (!listRes.ok || !optionsRes.ok) {
        setLoadError(true);
        return;
      }
      const listData = await listRes.json();
      const optionsData = await optionsRes.json();
      setOffers(Array.isArray(listData?.offers) ? listData.offers : []);
      setOptions(Array.isArray(optionsData?.offers) ? optionsData.offers : []);
    } catch {
      setLoadError(true);
    }
  }, [cycleId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  async function write(method: "POST" | "DELETE", body: object, fallback: string) {
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/ultimates/cycles/${cycleId}/excluded-offers`, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? fallback);
        return;
      }
      setSelected("");
      setSearch("");
      setNote("");
      await load();
      onChanged();
    } catch {
      setError(fallback);
    } finally {
      setBusy(false);
    }
  }

  function handleAdd() {
    const trimmed = note.trim();
    write(
      "POST",
      trimmed === "" ? { offerCode: selected } : { offerCode: selected, note: trimmed },
      "Não foi possível excluir a oferta."
    );
  }

  function handleRemove(offerCode: string) {
    write("DELETE", { offerCode }, "Não foi possível remover a oferta da lista.");
  }

  // Ofertas já excluídas saem do seletor — o POST as recusaria com 409, e
  // oferecer a opção seria convidar o gestor ao erro.
  const available = options.filter((o) => !o.is_excluded);
  const visible = available.filter((o) => matchesSearch(o, search));

  // Trocar a busca pode esconder a oferta que estava selecionada. Manter a
  // seleção invisível deixaria o gestor excluir uma oferta que não está mais
  // na tela — some com ela junto.
  function handleSearchChange(term: string) {
    setSearch(term);
    setError("");
    const current = available.find((o) => o.offer_code === selected);
    if (current && !matchesSearch(current, term)) setSelected("");
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Ofertas excluídas da contabilidade"
      className="ult-modal-overlay"
      data-testid="ultimates-excluded-offers-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="ult-modal-panel" style={{ maxWidth: 560 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-strong)", margin: 0 }}>
          Ofertas excluídas da contabilidade
        </h3>

        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>
          Compras feitas nas ofertas listadas aqui não entram nos KPIs, no gráfico nem no roster
          deste ciclo. Nenhuma venda é apagada — remover a oferta da lista devolve as compras à
          contabilidade.
        </p>

        {loadError && (
          <p data-testid="ultimates-excluded-offers-load-error" style={feedbackStyle("var(--color-danger)")}>
            Não foi possível carregar as ofertas.
          </p>
        )}

        {offers === null && !loadError && (
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>Carregando...</p>
        )}

        {offers !== null && offers.length === 0 && (
          <p
            data-testid="ultimates-excluded-offers-empty"
            style={{ fontSize: 12, color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}
          >
            Nenhuma oferta excluída — todas as compras do produto contam para este ciclo.
          </p>
        )}

        {offers !== null && offers.length > 0 && (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {offers.map((offer) => (
              <li
                key={offer.id}
                data-testid={`ultimates-excluded-offer-${offer.offer_code}`}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "10px 12px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-vis)",
                  background: "var(--surface)",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-strong)", margin: 0 }}>
                    {offer.offer_name ?? offer.offer_code}
                  </p>
                  <p style={{ fontSize: 11, color: "var(--text-3)", margin: "2px 0 0", fontFamily: "monospace" }}>
                    {offer.offer_code}
                  </p>
                  {offer.note && (
                    <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 0", lineHeight: 1.4 }}>
                      {offer.note}
                    </p>
                  )}
                  <p style={{ fontSize: 11, color: "var(--text-3)", margin: "4px 0 0" }}>
                    {offer.excluded_by_email ?? "autor não identificado"} · {fmtDateFull(offer.created_at)}
                  </p>
                </div>

                {canWrite && (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => handleRemove(offer.offer_code)}
                    disabled={busy}
                    data-testid={`ultimates-excluded-offer-remove-${offer.offer_code}`}
                    style={{ fontSize: 12, flexShrink: 0 }}
                  >
                    Remover
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* Só depois da carga: um seletor vazio durante o fetch convida a
            clicar em "Excluir oferta" sem nenhuma opção disponível. */}
        {canWrite && offers !== null && !loadError && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label className="mb-1 block text-sm font-medium" style={{ color: "var(--text-muted)" }}>
              Excluir uma oferta
            </label>

            <input
              type="search"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Buscar por código ou nome da oferta"
              aria-label="Buscar oferta por código ou nome"
              className="field-control"
              data-testid="ultimates-excluded-offer-search"
              style={{ fontSize: 13 }}
            />

            <select
              value={selected}
              onChange={(e) => {
                setSelected(e.target.value);
                setError("");
              }}
              className="field-control"
              data-testid="ultimates-excluded-offer-select"
              style={{ fontSize: 13 }}
            >
              <option value="">Selecione a oferta...</option>
              {visible.map((option) => (
                <option key={option.offer_code} value={option.offer_code}>
                  {option.product_name} · {option.offer_name} · {option.offer_code} · {option.sales_count} venda(s)
                </option>
              ))}
            </select>

            {search.trim() !== "" && visible.length === 0 && (
              <p
                data-testid="ultimates-excluded-offer-search-empty"
                style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}
              >
                Nenhuma oferta deste produto corresponde à busca.
              </p>
            )}

            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Motivo (opcional) — ex.: compras da equipe"
              maxLength={200}
              className="field-control"
              data-testid="ultimates-excluded-offer-note"
              style={{ fontSize: 13 }}
            />
          </div>
        )}

        {error && (
          <p data-testid="ultimates-excluded-offers-error" style={feedbackStyle("var(--color-danger)")}>
            {error}
          </p>
        )}

        <div className="ult-modal-actions">
          <button type="button" onClick={onClose} className="btn-secondary" disabled={busy}>
            Fechar
          </button>
          {canWrite && (
            <button
              type="button"
              onClick={handleAdd}
              disabled={busy || selected === ""}
              className="btn-primary"
              data-testid="ultimates-excluded-offer-add-btn"
            >
              {busy ? "Salvando..." : "Excluir oferta"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Busca por código OU nome: o gestor às vezes tem o código em mãos (copiado
// da Hotmart) e às vezes só sabe como a oferta se chama.
function matchesSearch(option: UltimatesOfferOption, term: string): boolean {
  const needle = term.trim().toLowerCase();
  if (needle === "") return true;
  return (
    option.offer_code.toLowerCase().includes(needle) ||
    (option.offer_name ?? "").toLowerCase().includes(needle) ||
    (option.product_name ?? "").toLowerCase().includes(needle)
  );
}

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
