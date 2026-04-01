"use client";

import { useEffect, useState } from "react";
import { LineChart } from "@/components/ui/line-chart";
import { DataTable } from "@/components/ui/data-table";

interface ProfileSnapshot {
  followers_count: number;
  reach: number;
  impressions: number;
  collected_at: string;
}

interface MediaRow {
  media_id: string;
  media_type: string;
  caption: string | null;
  permalink: string | null;
  like_count: number;
  comments_count: number;
  reach: number;
  impressions: number;
  saved: number;
  shares: number;
  plays: number;
  published_at: string;
  [key: string]: unknown;
}

export default function InstagramDetailPage() {
  const [profileData, setProfileData] = useState<ProfileSnapshot[]>([]);
  const [media, setMedia] = useState<MediaRow[]>([]);
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/instagram/profile?days=90")
      .then((r) => r.json())
      .then(setProfileData);
  }, []);

  useEffect(() => {
    setLoading(true);
    const url = typeFilter
      ? `/api/instagram/media?limit=100&type=${typeFilter}`
      : "/api/instagram/media?limit=100";
    fetch(url)
      .then((r) => r.json())
      .then(setMedia)
      .finally(() => setLoading(false));
  }, [typeFilter]);

  function exportCsv() {
    const headers = "Tipo,Legenda,Likes,Comentarios,Alcance,Impressoes,Salvos,Shares,Plays,Publicado\n";
    const rows = media
      .map(
        (m) =>
          `"${m.media_type}","${(m.caption || "").replace(/"/g, '""')}",${m.like_count},${m.comments_count},${m.reach},${m.impressions},${m.saved},${m.shares},${m.plays},"${m.published_at}"`
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

  return (
    <div className="space-y-6 max-w-5xl">
      <h2 className="text-xl font-semibold">Instagram - Detalhes</h2>

      {profileData.length > 1 && (
        <LineChart
          data={profileData}
          xKey="collected_at"
          lines={[
            { key: "followers_count", color: "#e11d48", label: "Seguidores" },
            { key: "reach", color: "#8b5cf6", label: "Alcance" },
            { key: "impressions", color: "#f59e0b", label: "Impressoes" },
          ]}
          height={350}
        />
      )}

      <div className="flex gap-2">
        {["", "IMAGE", "VIDEO", "CAROUSEL", "REEL", "STORY"].map((type) => (
          <button
            key={type}
            onClick={() => setTypeFilter(type)}
            className={`text-xs px-3 py-1 rounded border ${
              typeFilter === type
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            {type || "Todos"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-gray-400">Carregando...</div>
      ) : (
        <DataTable
          data={media}
          columns={[
            { key: "media_type", label: "Tipo" },
            {
              key: "caption",
              label: "Legenda",
              render: (v) => (
                <span className="truncate block max-w-xs text-sm">
                  {(v as string) || "(sem legenda)"}
                </span>
              ),
            },
            { key: "like_count", label: "Likes" },
            { key: "comments_count", label: "Coment." },
            { key: "reach", label: "Alcance" },
            { key: "impressions", label: "Impress." },
            { key: "saved", label: "Salvos" },
            { key: "plays", label: "Plays" },
            {
              key: "published_at",
              label: "Publicado",
              render: (v) =>
                v ? new Date(v as string).toLocaleDateString("pt-BR") : "",
            },
            {
              key: "permalink",
              label: "",
              render: (v) =>
                v ? (
                  <a
                    href={v as string}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline text-xs"
                  >
                    Ver
                  </a>
                ) : null,
            },
          ]}
          onExportCsv={exportCsv}
        />
      )}
    </div>
  );
}
