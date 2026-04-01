"use client";

import { useEffect, useState } from "react";
import { KpiCard } from "@/components/ui/kpi-card";
import { LineChart } from "@/components/ui/line-chart";

interface ChannelSnapshot {
  subscriber_count: number;
  view_count: number;
  video_count: number;
  collected_at: string;
}

interface VideoSnapshot {
  video_id: string;
  title: string;
  view_count: number;
  like_count: number;
  comment_count: number;
  thumbnail_url: string;
}

export function YouTubeOverview() {
  const [channelData, setChannelData] = useState<ChannelSnapshot[]>([]);
  const [videos, setVideos] = useState<VideoSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/youtube/channel?days=30").then((r) => r.json()),
      fetch("/api/youtube/videos?limit=5").then((r) => r.json()),
    ])
      .then(([channel, vids]) => {
        setChannelData(channel);
        setVideos(vids);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-400">Carregando YouTube...</div>;

  const latest = channelData[channelData.length - 1];
  const previous = channelData.length > 1 ? channelData[channelData.length - 2] : undefined;

  return (
    <section>
      <h3 className="text-lg font-semibold mb-3">YouTube</h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {latest && (
          <>
            <KpiCard
              title="Inscritos"
              value={latest.subscriber_count}
              format="compact"
              currentValue={latest.subscriber_count}
              previousValue={previous?.subscriber_count}
            />
            <KpiCard
              title="Views Totais"
              value={latest.view_count}
              format="compact"
              currentValue={latest.view_count}
              previousValue={previous?.view_count}
            />
            <KpiCard
              title="Videos"
              value={latest.video_count}
              currentValue={latest.video_count}
              previousValue={previous?.video_count}
            />
          </>
        )}
      </div>

      {channelData.length > 1 && (
        <div className="mb-4">
          <LineChart
            data={channelData}
            xKey="collected_at"
            lines={[
              { key: "subscriber_count", color: "#ef4444", label: "Inscritos" },
              { key: "view_count", color: "#3b82f6", label: "Views" },
            ]}
          />
        </div>
      )}

      {videos.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-600">Top Videos</p>
          {videos.map((video) => (
            <div
              key={video.video_id}
              className="flex items-center gap-3 bg-white border rounded-lg p-2"
            >
              <img
                src={video.thumbnail_url}
                alt={video.title}
                className="w-24 h-14 object-cover rounded"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{video.title}</p>
                <p className="text-xs text-gray-500">
                  {Intl.NumberFormat("pt-BR", { notation: "compact" }).format(video.view_count)} views
                  {" · "}
                  {Intl.NumberFormat("pt-BR", { notation: "compact" }).format(video.like_count)} likes
                  {" · "}
                  {Intl.NumberFormat("pt-BR", { notation: "compact" }).format(video.comment_count)} comentarios
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
