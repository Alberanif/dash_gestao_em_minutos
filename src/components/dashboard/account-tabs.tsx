"use client";

import type { Account } from "@/types/accounts";

interface AccountTabsProps {
  accounts: Account[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export function AccountTabs({ accounts, selectedId, onSelect }: AccountTabsProps) {
  if (accounts.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {accounts.map((account) => (
        <button
          key={account.id}
          onClick={() => onSelect(account.id)}
          className="rounded-[var(--radius-sm)] px-3.5 py-1.5 text-[13px] font-medium transition-colors hover:bg-[var(--color-primary-light)]"
          style={
            account.id === selectedId
              ? {
                  background: "var(--color-primary)",
                  border: "1px solid var(--color-primary)",
                  color: "white",
                }
              : {
                  background: "transparent",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text-muted)",
                }
          }
        >
          {account.name}
        </button>
      ))}
    </div>
  );
}
