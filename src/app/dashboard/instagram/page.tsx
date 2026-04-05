"use client";

import { useEffect, useState } from "react";
import { AccountTabs } from "@/components/dashboard/account-tabs";
import { SectionTabs } from "@/components/dashboard/section-tabs";
import { KpiCard } from "@/components/ui/kpi-card";
import { LineChart } from "@/components/ui/line-chart";
import { DataTable } from "@/components/ui/data-table";
import type { Account, ProfileSnapshot, MediaSnapshot } from "@/types/accounts";

const SECTIONS = ["Visão Geral", "Posts/Reels", "Tendências"];

export default function InstagramPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [selectedSection, setSelectedSection] = useState("Visão Geral");
  const [profileData, setProfileData] = useState<ProfileSnapshot[]>([]);
  const [media, setMedia] = useState<MediaSnapshot[]>([]);
  const [loading, setLoading] = useState(false);

  // Load Instagram accounts
  useEffect(() => {
    fetch("/api/accounts?platform=instagram")
      .then((r) => r.json())
      .then((accs: Account[]) => {
        setAccounts(accs);
        if (accs.length > 0) setSelectedId(accs[0].id);
      });
  }, []);

  // Load data when selected account changes
  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/instagram/profile?account_id=${selectedId}&days=90`).then((r) => r.json()),
      fetch(`/api/instagram/media?account_id=${selectedId}&limit=100`).then((r) => r.json()),
    ])
      .then(([profile, med]) => {
        setProfileData(Array.isArray(profile) ? profile : []);
        setMedia(Array.isArray(med) ? med : []);
      })
      .finally(() => setLoading(false));
  }, [selectedId]);

  const latest = profileData[profileData.length - 1];
  const previous = profileData[profileData.length - 2];

  function exportCsv() {
    const headers = "Tipo,Legenda,Curtidas,Comentarios,Alcance,Impressoes,Plays,Publicado\n";
    const rows = media
      .map(
        (m) =>
          `"${m.media_type}","${(m.caption ?? "").replace(/"/g, "''")}",${m.like_count},${m.comments_count},${m.reach},${m.impressions},${m.plays},"${m.published_at}"`
      )
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "instagram_media.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (accounts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400">
        <p className="text-lg mb-2">Nenhuma conta Instagram cadastrada</p>
        <a href="/dashboard/settings" className="text-blue-600 text-sm hover:underline">
          Cadastrar conta em Configurações →
        </a>
      </div>
    );
  }

  return (
    <div>
      <AccountTabs
        accounts={accounts}
        selectedId={selectedId}
        onSelect={(id) => {
          setSelectedId(id);
          setSelectedSection("Visão Geral");
        }}
      />
      <SectionTabs
        sections={SECTIONS}
        selected={selectedSection}
        onSelect={setSelectedSection}
      />

      <div className="p-6 max-w-5xl">
        {loading && <div className="text-gray-400">Carregando...</div>}

        {!loading && selectedSection === "Visão Geral" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <KpiCard
              title="Seguidores"
              value={latest?.followers_count ?? 0}
              format="compact"
              previousValue={previous?.followers_count}
              currentValue={latest?.followers_count}
            />
            <KpiCard
              title="Alcance (28d)"
              value={latest?.reach ?? 0}
              format="compact"
              previousValue={previous?.reach}
              currentValue={latest?.reach}
            />
            <KpiCard
              title="Impressões (28d)"
              value={latest?.impressions ?? 0}
              format="compact"
              previousValue={previous?.impressions}
              currentValue={latest?.impressions}
            />
          </div>
        )}

        {!loading && selectedSection === "Posts/Reels" && (
          <DataTable
            data={media}
            columns={[
              {
                key: "media_type",
                label: "Tipo",
                render: (v) => (
                  <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full font-medium">
                    {v as string}
                  </span>
                ),
              },
              {
                key: "caption",
                label: "Legenda",
                render: (v) => (
                  <span className="text-sm text-gray-600 line-clamp-2 max-w-xs">
                    {(v as string) || "—"}
                  </span>
                ),
              },
              { key: "like_count", label: "Curtidas" },
              { key: "comments_count", label: "Comentários" },
              { key: "reach", label: "Alcance" },
              { key: "plays", label: "Plays" },
              {
                key: "published_at",
                label: "Publicado",
                render: (v) =>
                  v ? new Date(v as string).toLocaleDateString("pt-BR") : "",
              },
            ]}
            onExportCsv={exportCsv}
          />
        )}

        {!loading && selectedSection === "Tendências" && profileData.length > 1 && (
          <LineChart
            data={profileData}
            xKey="collected_at"
            lines={[
              { key: "followers_count", color: "#e1306c", label: "Seguidores" },
              { key: "reach", color: "#f59e0b", label: "Alcance" },
              { key: "impressions", color: "#8b5cf6", label: "Impressões" },
            ]}
            height={350}
          />
        )}

        {!loading && selectedSection === "Tendências" && profileData.length <= 1 && (
          <div className="text-gray-400 py-12 text-center">
            Dados insuficientes para exibir tendências. Execute o cron pelo menos 2 vezes.
          </div>
        )}
      </div>
    </div>
  );
}
