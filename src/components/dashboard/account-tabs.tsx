"use client";

import type { Account } from "@/types/accounts";

interface AccountTabsProps {
  accounts: Account[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export function AccountTabs({ accounts, selectedId, onSelect }: AccountTabsProps) {
  if (accounts.length === 0) return null;

  const single = accounts.length === 1;

  return (
    <div className="pset">
      {accounts.map((account) => (
        <button
          key={account.id}
          onClick={single ? undefined : () => onSelect(account.id)}
          title={single ? "Única conta cadastrada" : undefined}
          className={`pb${account.id === selectedId ? " on" : ""}${single ? " cursor-default opacity-60" : ""}`}
        >
          {account.name}
        </button>
      ))}
    </div>
  );
}
