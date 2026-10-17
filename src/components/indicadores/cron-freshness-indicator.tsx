"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  formatAge,
  hasCurrentError,
  summarizeFreshness,
  type AccountCronStatus,
  type FreshnessLevel,
} from "@/lib/indicadores/cron-freshness";

const LEVEL_COLOR: Record<FreshnessLevel, string> = {
  green: "var(--green)",
  amber: "var(--amber)",
  red: "var(--red)",
  none: "var(--text-muted)",
};

const PLATFORM_LABEL: Record<string, string> = {
  hotmart: "Hotmart",
  "meta-ads": "Meta Ads",
};

function formatDateTime(iso: string | null): string {
  if (!iso) return "nunca";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "nunca";
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/** Indicador "Atualizado há X min" do cabeçalho de /indicadores; abre a lista por conta. */
export function CronFreshnessIndicator({ now }: { now?: () => Date } = {}) {
  const [accounts, setAccounts] = useState<AccountCronStatus[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/indicadores/cron-status")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((body: { accounts?: AccountCronStatus[] } | null) => {
        if (!cancelled) setAccounts(body?.accounts ?? null);
        if (!cancelled && !body?.accounts) setFailed(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  if (failed || accounts === null) return null;

  const current = now ? now() : new Date();
  const { level, minutes } = summarizeFreshness(accounts, current);
  const color = LEVEL_COLOR[level];
  const label =
    level === "none"
      ? "Sem contas monitoradas"
      : minutes === null
        ? "Sem coleta registrada"
        : `Atualizado ${formatAge(minutes)}`;

  return (
    <div ref={rootRef} className="cron-fresh">
      <button
        type="button"
        className="cron-fresh-btn"
        data-testid="cron-freshness-button"
        data-level={level}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="cron-fresh-dot" style={{ background: color }} aria-hidden />
        {label}
      </button>

      {open && (
        <div className="cron-fresh-pop" role="dialog" aria-label="Última coleta por conta" data-testid="cron-freshness-list">
          <div className="cron-fresh-title">Última coleta por conta</div>
          {accounts.length === 0 ? (
            <div className="cron-fresh-empty">Nenhuma conta ativa de Hotmart ou Meta Ads.</div>
          ) : (
            <ul className="cron-fresh-list">
              {accounts.map((a) => (
                <li key={a.account_id} className="cron-fresh-item" data-testid="cron-freshness-item">
                  <div className="cron-fresh-name">
                    <span>{a.name}</span>
                    <span className="cron-fresh-plat">{PLATFORM_LABEL[a.platform] ?? a.platform}</span>
                  </div>
                  {hasCurrentError(a) ? (
                    <>
                      <div className="cron-fresh-row cron-fresh-bad">Falhou em {formatDateTime(a.last_error_at)}</div>
                      <div className="cron-fresh-err" data-testid="cron-freshness-error">
                        {a.last_error_message}
                      </div>
                    </>
                  ) : (
                    <div className="cron-fresh-row cron-fresh-ok" data-testid="cron-freshness-ok">
                      Atualizado em {formatDateTime(a.last_success_at)}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
