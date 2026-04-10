"use client";

import { useState } from "react";
import type { Account } from "@/types/accounts";
import { StatusBadge } from "@/components/ui/status-badge";
import { AccountForm } from "./account-form";

interface AccountListProps {
  initialAccounts: Account[];
}

const PLATFORM_LABELS: Record<string, string> = {
  youtube: "YouTube",
  instagram: "Instagram",
  "meta-ads": "Meta Ads",
  hotmart: "Hotmart",
};

export function AccountList({ initialAccounts }: AccountListProps) {
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts);
  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | undefined>();

  async function loadAccounts() {
    const res = await fetch("/api/accounts");
    const data = await res.json();
    setAccounts(data);
  }

  async function toggleActive(account: Account) {
    await fetch(`/api/accounts/${account.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !account.is_active }),
    });
    await loadAccounts();
  }

  async function deleteAccount(account: Account) {
    if (
      !confirm(
        `Remover "${account.name}"? Todos os dados coletados desta conta serão apagados permanentemente.`
      )
    )
      return;

    await fetch(`/api/accounts/${account.id}`, { method: "DELETE" });
    await loadAccounts();
  }

  function handleSave() {
    setShowForm(false);
    setEditingAccount(undefined);
    loadAccounts();
  }

  const byPlatform = {
    youtube: accounts.filter((a) => a.platform === "youtube"),
    instagram: accounts.filter((a) => a.platform === "instagram"),
    "meta-ads": accounts.filter((a) => a.platform === "meta-ads"),
    hotmart: accounts.filter((a) => a.platform === "hotmart"),
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text)" }}>Contas registradas</h2>
          <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>Conexões ativas para YouTube, Instagram, Meta Ads e Hotmart.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="btn-primary"
        >
          + Nova conta
        </button>
      </div>

      {accounts.length === 0 && (
        <div className="py-12 text-center" style={{ color: "var(--color-text-muted)" }}>
          Nenhuma conta cadastrada. Clique em &ldquo;+ Nova conta&rdquo; para começar.
        </div>
      )}

      {(["youtube", "instagram", "meta-ads", "hotmart"] as const).map((platform) => {
        const platformAccounts = byPlatform[platform];
        if (platformAccounts.length === 0) return null;

        return (
          <div key={platform} className="mb-8">
            <h3 className="mb-3 uppercase tracking-[0.08em]" style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-muted)" }}>
              {PLATFORM_LABELS[platform]}
            </h3>
            <div className="space-y-2">
              {platformAccounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center gap-3 rounded-[var(--radius-card)] px-4 py-4"
                  style={{ background: "#F8FAFC", border: "1px solid var(--color-border)" }}
                >
                  <StatusBadge tone="analysis" label={PLATFORM_LABELS[platform]} />
                  <div className="flex-1">
                    <p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>{account.name}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <StatusBadge tone={account.is_active ? "active" : "inactive"} />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <button
                      onClick={() => toggleActive(account)}
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      {account.is_active ? "desativar" : "ativar"}
                    </button>
                    <button
                      onClick={() => {
                        setEditingAccount(account);
                        setShowForm(true);
                      }}
                      style={{ color: "var(--color-primary)" }}
                    >
                      editar
                    </button>
                    <button
                      onClick={() => deleteAccount(account)}
                      style={{ color: "var(--color-danger)" }}
                    >
                      remover
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {showForm && (
        <AccountForm
          account={editingAccount}
          onSave={handleSave}
          onCancel={() => {
            setShowForm(false);
            setEditingAccount(undefined);
          }}
        />
      )}
    </div>
  );
}
