"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DateRangeControls } from "@/components/layout/date-range-controls";
import { YouTubeSummaryCard } from "@/components/prestar-atencao/youtube-summary-card";
import { InstagramSummaryCard } from "@/components/prestar-atencao/instagram-summary-card";
import type { Account } from "@/types/accounts";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export default function PrestarAtencaoPage() {
  const [ytAccounts, setYtAccounts] = useState<Account[]>([]);
  const [igAccounts, setIgAccounts] = useState<Account[]>([]);
  const [selectedYtId, setSelectedYtId] = useState("");
  const [selectedIgId, setSelectedIgId] = useState("");

  const [startDate, setStartDate] = useState(daysAgo(30));
  const [endDate, setEndDate] = useState(today());
  const [appliedStart, setAppliedStart] = useState(daysAgo(30));
  const [appliedEnd, setAppliedEnd] = useState(today());

  function applyDateFilter() {
    setAppliedStart(startDate);
    setAppliedEnd(endDate);
  }

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const [ytRes, igRes] = await Promise.all([
          fetch("/api/accounts?platform=youtube"),
          fetch("/api/accounts?platform=instagram"),
        ]);

        if (ytRes.ok) {
          const yt = await ytRes.json();
          setYtAccounts(yt);
          if (yt.length > 0) {
            setSelectedYtId(yt[0].id);
          }
        }

        if (igRes.ok) {
          const ig = await igRes.json();
          setIgAccounts(ig);
          if (ig.length > 0) {
            setSelectedIgId(ig[0].id);
          }
        }
      } catch (error) {
        console.error("Erro ao buscar contas:", error);
      }
    };

    fetchAccounts();
  }, []);

  const headerActions = (
    <DateRangeControls
      startDate={startDate}
      endDate={endDate}
      onStartDateChange={setStartDate}
      onEndDateChange={setEndDate}
      onApply={applyDateFilter}
    />
  );

  return (
    <div className="min-h-full">
      <PageHeader title="Prestar Atenção" subtitle="Resumo de performance social" actions={headerActions} />
      <div style={{ padding: "24px" }}>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <YouTubeSummaryCard
            accountId={selectedYtId}
            accounts={ytAccounts}
            startDate={appliedStart}
            endDate={appliedEnd}
            onSelectAccount={setSelectedYtId}
          />
          <InstagramSummaryCard
            accountId={selectedIgId}
            accounts={igAccounts}
            startDate={appliedStart}
            endDate={appliedEnd}
            onSelectAccount={setSelectedIgId}
          />
        </div>
      </div>
    </div>
  );
}
