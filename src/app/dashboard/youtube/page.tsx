"use client";

import { useEffect, useState } from "react";
import { LineChart } from "@/components/ui/line-chart";
import { DataTable } from "@/components/ui/data-table";

interface ChannelSnapshot {
  subscriber_count: number;
  view_count: number;
  video_count: number;
  collected_at: string;
}

interface VideoRow {
  video_id: string;
  title: string;
  view_count: number;
  like_count: number;
  comment_count: number;
  duration: string;
  published_at: string;
  thumbnail_url: string;
  [key: string]: unknown;
}

export default function YouTubeDetailPage() {
  const [channelData, setChannelData] = useState<ChannelSnapshot[]>([]);
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/youtube/channel?days=90").then((r) => r.json()),
      fetch("/api/youtube/videos?limit=100").then((r) => r.json()),
    ])
      .then(([channel, vids]) => {
        setChannelData(channel);
        setVideos(vids);
      })
      .finally(() => setLoading(false));
  }, []);

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

  if (loading) return <div className="text-gray-400">Carregando...</div>;

  return (
    <div className="space-y-6 max-w-5xl">
      <h2 className="text-xl font-semibold">YouTube - Detalhes</h2>

      {channelData.length > 1 && (
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

      <DataTable
        data={videos}
        columns={[
          {
            key: "title",
            label: "Titulo",
            render: (_, row) => (
              <div className="flex items-center gap-2 max-w-xs">
                <img src={row.thumbnail_url} alt="" className="w-16 h-9 object-cover rounded" />
                <span className="truncate text-sm">{row.title}</span>
              </div>
            ),
          },
          { key: "view_count", label: "Views" },
          { key: "like_count", label: "Likes" },
          { key: "comment_count", label: "Comentarios" },
          { key: "duration", label: "Duracao" },
          {
            key: "published_at",
            label: "Publicado",
            render: (v) =>
              v ? new Date(v as string).toLocaleDateString("pt-BR") : "",
          },
        ]}
        onExportCsv={exportCsv}
      />
    </div>
  );
}
