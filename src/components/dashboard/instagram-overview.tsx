"use client";

import { useEffect, useState } from "react";
import { KpiCard } from "@/components/ui/kpi-card";
import { LineChart } from "@/components/ui/line-chart";

interface ProfileSnapshot {
  followers_count: number;
  follows_count: number;
  media_count: number;
  impressions: number;
  reach: number;
  collected_at: string;
}

interface MediaItem {
  media_id: string;
  media_type: string;
  caption: string | null;
  permalink: string | null;
  reach: number;
  impressions: number;
  like_count: number;
  comments_count: number;
  plays: number;
}

export function InstagramOverview() {
  const [profileData, setProfileData] = useState<ProfileSnapshot[]>([]);
  const [topPosts, setTopPosts] = useState<MediaItem[]>([]);
  const [reels, setReels] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/instagram/profile?days=30").then((r) => r.json()),
      fetch("/api/instagram/media?limit=5").then((r) => r.json()),
      fetch("/api/instagram/media?type=REEL&limit=5").then((r) => r.json()),
    ])
      .then(([profile, posts, reelData]) => {
        setProfileData(profile);
        setTopPosts(posts);
        setReels(reelData);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-400">Carregando Instagram...</div>;

  const latest = profileData[profileData.length - 1];
  const previous = profileData.length > 1 ? profileData[profileData.length - 2] : undefined;

  return (
    <section>
      <h3 className="text-lg font-semibold mb-3">Instagram</h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {latest && (
          <>
            <KpiCard
              title="Seguidores"
              value={latest.followers_count}
              format="compact"
              currentValue={latest.followers_count}
              previousValue={previous?.followers_count}
            />
            <KpiCard
              title="Alcance (28d)"
              value={latest.reach}
              format="compact"
              currentValue={latest.reach}
              previousValue={previous?.reach}
            />
            <KpiCard
              title="Impressoes (28d)"
              value={latest.impressions}
              format="compact"
              currentValue={latest.impressions}
              previousValue={previous?.impressions}
            />
          </>
        )}
      </div>

      {profileData.length > 1 && (
        <div className="mb-4">
          <LineChart
            data={profileData}
            xKey="collected_at"
            lines={[
              { key: "followers_count", color: "#e11d48", label: "Seguidores" },
              { key: "reach", color: "#8b5cf6", label: "Alcance" },
            ]}
          />
        </div>
      )}

      {topPosts.length > 0 && (
        <div className="mb-4">
          <p className="text-sm font-medium text-gray-600 mb-2">Top Posts por Alcance</p>
          <div className="space-y-2">
            {topPosts.map((post) => (
              <div
                key={post.media_id}
                className="flex items-center gap-3 bg-white border rounded-lg p-2"
              >
                <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                  {post.media_type}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{post.caption || "(sem legenda)"}</p>
                  <p className="text-xs text-gray-500">
                    Alcance: {Intl.NumberFormat("pt-BR", { notation: "compact" }).format(post.reach)}
                    {" · "}
                    {Intl.NumberFormat("pt-BR", { notation: "compact" }).format(post.like_count)} likes
                    {" · "}
                    {Intl.NumberFormat("pt-BR", { notation: "compact" }).format(post.comments_count)} comentarios
                  </p>
                </div>
                {post.permalink && (
                  <a
                    href={post.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Ver
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {reels.length > 0 && (
        <div>
          <p className="text-sm font-medium text-gray-600 mb-2">Reels Recentes</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {reels.map((reel) => (
              <div key={reel.media_id} className="bg-white border rounded-lg p-2 text-sm">
                <p className="truncate">{reel.caption || "(sem legenda)"}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {Intl.NumberFormat("pt-BR", { notation: "compact" }).format(reel.plays)} plays
                  {" · "}
                  {Intl.NumberFormat("pt-BR", { notation: "compact" }).format(reel.reach)} alcance
                  {" · "}
                  {Intl.NumberFormat("pt-BR", { notation: "compact" }).format(reel.shares || 0)} shares
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
