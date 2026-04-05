"use client";

import { useState } from "react";
import type { Account } from "@/types/accounts";
import { AccountForm } from "./account-form";

interface AccountListProps {
  initialAccounts: Account[];
}

const PLATFORM_ICONS: Record<string, string> = {
  youtube: "▶",
  instagram: "📷",
};

const PLATFORM_COLORS: Record<string, string> = {
  youtube: "bg-red-100 text-red-700",
  instagram: "bg-pink-100 text-pink-700",
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
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Contas registradas</h2>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
        >
          + Nova conta
        </button>
      </div>

      {accounts.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          Nenhuma conta cadastrada. Clique em &ldquo;+ Nova conta&rdquo; para começar.
        </div>
      )}

      {(["youtube", "instagram"] as const).map((platform) => {
        const platformAccounts = byPlatform[platform];
        if (platformAccounts.length === 0) return null;

        return (
          <div key={platform} className="mb-8">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
              {PLATFORM_ICONS[platform]} {platform === "youtube" ? "YouTube" : "Instagram"}
            </h3>
            <div className="space-y-2">
              {platformAccounts.map((account) => (
                <div
                  key={account.id}
                  className="bg-white border rounded-lg px-4 py-3 flex items-center gap-3"
                >
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${PLATFORM_COLORS[platform]}`}
                  >
                    {PLATFORM_ICONS[platform]}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{account.name}</p>
                    <p className="text-xs text-gray-400">
                      {platform} ·{" "}
                      {account.is_active ? (
                        <span className="text-green-600">● ativo</span>
                      ) : (
                        <span className="text-gray-400">○ inativo</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <button
                      onClick={() => toggleActive(account)}
                      className="text-gray-400 hover:text-gray-700"
                    >
                      {account.is_active ? "desativar" : "ativar"}
                    </button>
                    <button
                      onClick={() => {
                        setEditingAccount(account);
                        setShowForm(true);
                      }}
                      className="text-blue-500 hover:text-blue-700"
                    >
                      editar
                    </button>
                    <button
                      onClick={() => deleteAccount(account)}
                      className="text-red-400 hover:text-red-600"
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
