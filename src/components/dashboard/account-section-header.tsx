"use client";

import { AccountTabs } from "./account-tabs";
import type { Account } from "@/types/accounts";

interface AccountSectionHeaderProps {
  title: string;
  accounts: Account[] | null;
  selectedId: string;
  onSelect: (id: string) => void;
}

export function AccountSectionHeader({ title, accounts, selectedId, onSelect }: AccountSectionHeaderProps) {
  return (
    <div className="stitle" style={{ justifyContent: "space-between", marginBottom: "12px" }}>
      <h2>{title}</h2>
      {accounts === null ? (
        <div className="animate-pulse" style={{ height: "30px", width: "180px", borderRadius: "8px", background: "var(--br)" }} />
      ) : (
        <AccountTabs accounts={accounts} selectedId={selectedId} onSelect={onSelect} />
      )}
    </div>
  );
}
