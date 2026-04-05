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
    <div className="flex gap-2 px-6 py-2 border-b bg-white">
      {accounts.map((account) => (
        <button
          key={account.id}
          onClick={() => onSelect(account.id)}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
            account.id === selectedId
              ? "bg-blue-600 text-white"
              : "text-gray-500 border hover:text-gray-700 hover:bg-gray-50"
          }`}
        >
          {account.name}
        </button>
      ))}
    </div>
  );
}
