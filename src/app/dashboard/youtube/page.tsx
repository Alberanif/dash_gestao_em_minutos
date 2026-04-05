"use client";

import { useEffect, useState } from "react";
import { AccountTabs } from "@/components/dashboard/account-tabs";
import { SectionTabs } from "@/components/dashboard/section-tabs";
import { KpiCard } from "@/components/ui/kpi-card";
import { LineChart } from "@/components/ui/line-chart";
import { DataTable } from "@/components/ui/data-table";
import type { Account, ChannelSnapshot, VideoSnapshot } from "@/types/accounts";

const SECTIONS = ["Visão Geral", "Vídeos", "Tendências"];

export default function YouTubePage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [selectedSection, setSelectedSection] = useState("Visão Geral");
  const [channelData, setChannelData] = useState<ChannelSnapshot[]>([]);
  const [videos, setVideos] = useState<VideoSnapshot[]>([]);
  const [loading, setLoading] = useState(false);

  // Load YouTube accounts
  useEffect(() => {
    fetch("/api/accounts?platform=youtube")
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
      fetch(`/api/youtube/channel?account_id=${selectedId}&days=90`).then((r) => r.json()),
      fetch(`/api/youtube/videos?account_id=${selectedId}&limit=100`).then((r) => r.json()),
    ])
      .then(([channel, vids]) => {
        setChannelData(Array.isArray(channel) ? channel : []);
        setVideos(Array.isArray(vids) ? vids : []);
      })
      .finally(() => setLoading(false));
  }, [selectedId]);

  const latest = channelData[channelData.length - 1];
  const previous = channelData[channelData.length - 2];

  function exportCsv() {
    const headers = "Titulo,Views,Likes,Comentarios,Duracao,Publicado\n";
    const rows = videos
      .map(
        (v) =>
          `"${v.title}",${v.view_count},${v.like_count},${v.comment_count},"${v.duration}","${v.published_at}"`
      )
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "youtube_videos.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (accounts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400">
        <p className="text-lg mb-2">Nenhuma conta YouTube cadastrada</p>
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
              title="Inscritos"
              value={latest?.subscriber_count ?? 0}
              format="compact"
              previousValue={previous?.subscriber_count}
              currentValue={latest?.subscriber_count}
            />
            <KpiCard
              title="Views Totais"
              value={latest?.view_count ?? 0}
              format="compact"
              previousValue={previous?.view_count}
              currentValue={latest?.view_count}
            />
            <KpiCard
              title="Vídeos"
              value={latest?.video_count ?? 0}
              previousValue={previous?.video_count}
              currentValue={latest?.video_count}
            />
          </div>
        )}

        {!loading && selectedSection === "Vídeos" && (
          <DataTable
            data={videos}
            columns={[
              {
                key: "title",
                label: "Título",
                render: (_, row) => (
                  <div className="flex items-center gap-2 max-w-xs">
                    <img
                      src={row.thumbnail_url as string}
                      alt=""
                      className="w-16 h-9 object-cover rounded"
                    />
                    <span className="truncate text-sm">{row.title as string}</span>
                  </div>
                ),
              },
              { key: "view_count", label: "Views" },
              { key: "like_count", label: "Likes" },
              { key: "comment_count", label: "Comentários" },
              { key: "duration", label: "Duração" },
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

        {!loading && selectedSection === "Tendências" && channelData.length > 1 && (
          <LineChart
            data={channelData}
            xKey="collected_at"
            lines={[
              { key: "subscriber_count", color: "#ef4444", label: "Inscritos" },
              { key: "view_count", color: "#3b82f6", label: "Views Totais" },
            ]}
            height={350}
          />
        )}

        {!loading && selectedSection === "Tendências" && channelData.length <= 1 && (
          <div className="text-gray-400 py-12 text-center">
            Dados insuficientes para exibir tendências. Execute o cron pelo menos 2 vezes.
          </div>
        )}
      </div>
    </div>
  );
}
