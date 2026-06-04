import React from "react";
import { GvPageHeader } from "@/components/gv/gv-page-header";
import { PulseBanner } from "@/components/gv/pulse-banner";
import { NarrLabel } from "@/components/gv/narr-label";
import { HealthCard } from "@/components/gv/health-card";
import { CockpitTile } from "@/components/gv/cockpit-tile";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  calcPlatformScore,
  derivePulseBanner,
  deriveTiles,
  type MetricRow,
  type PlatformHealth,
  type Status,
} from "./logic";

// ── Date helpers ──────────────────────────────────────────────────────────────

function dateMinus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}

// ── Status & format helpers ───────────────────────────────────────────────────

function deltaStatus(curr: number, prev: number): Status {
  if (curr === 0 && prev === 0) return "amber";
  if (prev === 0) return curr > 0 ? "green" : "amber";
  const pct = ((curr - prev) / prev) * 100;
  if (pct >= -5) return "green";
  if (pct >= -20) return "amber";
  return "red";
}

function platformStatus(rows: MetricRow[]): Status {
  if (rows.some((r) => r.status === "red")) return "red";
  if (rows.every((r) => r.status === "green")) return "green";
  return "amber";
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}

function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

function fmtHours(mins: number): string {
  return `${fmtNum(Math.round(mins / 60))}h`;
}

// ── Supabase row types (local) ────────────────────────────────────────────────

interface YtRow {
  date: string;
  account_id: string;
  views: number;
  estimated_minutes_watched: number;
  subscriber_count: number;
  likes: number;
  comments: number;
}

interface IgProfileRow {
  date: string;
  account_id: string;
  followers_count: number;
  reach: number;
}

interface IgMediaRow {
  account_id: string;
  media_type: string;
  engagement_rate: number;
  comments_count: number;
  published_at: string;
}

// ── Fallback rows (no data) ───────────────────────────────────────────────────

const YT_FALLBACK: MetricRow[] = [
  { label: "Inscritos", help: "Total acumulado no canal", value: "--", status: "amber" },
  { label: "Visualizações", help: "Vídeos assistidos no período", value: "--", status: "amber" },
  { label: "Tempo assistido", help: "Horas totais assistidas", value: "--", status: "amber" },
  { label: "Engajamento", help: "Likes e comentários", value: "--", status: "amber" },
];

const IG_FALLBACK: MetricRow[] = [
  { label: "Seguidores", help: "Total acumulado do perfil", value: "--", status: "amber" },
  { label: "Alcance", help: "Contas únicas alcançadas", value: "--", status: "amber" },
  { label: "Engajamento Reels", help: "Likes e comentários em Reels", value: "--", status: "amber" },
  { label: "Comentários", help: "Total de comentários no período", value: "--", status: "amber" },
];

// ── Data fetching ─────────────────────────────────────────────────────────────

async function fetchMetrics(): Promise<{ ytRows: MetricRow[]; igRows: MetricRow[] }> {
  const supabase = await createSupabaseServerClient();

  // Last 7 days vs previous 7 days
  const currentEnd = dateMinus(0);
  const currentStart = dateMinus(6);
  const previousEnd = dateMinus(7);
  const previousStart = dateMinus(13);

  // Accounts
  const { data: accounts } = await supabase
    .from("dash_gestao_accounts")
    .select("id, platform")
    .in("platform", ["youtube", "instagram"]);

  const ytIds = (accounts ?? [])
    .filter((a: { platform: string }) => a.platform === "youtube")
    .map((a: { id: string }) => a.id);
  const igIds = (accounts ?? [])
    .filter((a: { platform: string }) => a.platform === "instagram")
    .map((a: { id: string }) => a.id);

  // ── YouTube ──────────────────────────────────────────────────────────────

  let ytRows: MetricRow[] = YT_FALLBACK;

  if (ytIds.length > 0) {
    const { data: raw } = await supabase
      .from("dash_gestao_youtube_channel_daily")
      .select(
        "date, account_id, views, estimated_minutes_watched, subscriber_count, likes, comments"
      )
      .in("account_id", ytIds)
      .gte("date", previousStart)
      .lte("date", currentEnd)
      .order("date", { ascending: true });

    const all = (raw ?? []) as YtRow[];
    const curr = all.filter((r) => r.date >= currentStart);
    const prev = all.filter((r) => r.date >= previousStart && r.date <= previousEnd);

    if (curr.length > 0) {
      // Inscritos: latest snapshot per account, summed
      const subCurr = ytIds.reduce((sum, id) => {
        const rows = curr.filter((r) => r.account_id === id);
        return sum + (rows.length ? rows[rows.length - 1].subscriber_count ?? 0 : 0);
      }, 0);
      const subPrev = ytIds.reduce((sum, id) => {
        const rows = prev.filter((r) => r.account_id === id);
        return sum + (rows.length ? rows[rows.length - 1].subscriber_count ?? 0 : 0);
      }, 0);

      // Visualizações
      const viewsCurr = curr.reduce((s, r) => s + (r.views ?? 0), 0);
      const viewsPrev = prev.reduce((s, r) => s + (r.views ?? 0), 0);

      // Tempo assistido (minutes → hours)
      const watchCurr = curr.reduce((s, r) => s + (r.estimated_minutes_watched ?? 0), 0);
      const watchPrev = prev.reduce((s, r) => s + (r.estimated_minutes_watched ?? 0), 0);

      // Engajamento: (likes + comments) / views * 100
      const engNumerCurr =
        curr.reduce((s, r) => s + (r.likes ?? 0), 0) +
        curr.reduce((s, r) => s + (r.comments ?? 0), 0);
      const engNumerPrev =
        prev.reduce((s, r) => s + (r.likes ?? 0), 0) +
        prev.reduce((s, r) => s + (r.comments ?? 0), 0);
      const engCurr = viewsCurr > 0 ? (engNumerCurr / viewsCurr) * 100 : 0;
      const engPrev = viewsPrev > 0 ? (engNumerPrev / viewsPrev) * 100 : 0;

      ytRows = [
        {
          label: "Inscritos",
          help: "Total acumulado no canal",
          value: subCurr > 0 ? fmtNum(subCurr) : "--",
          status: deltaStatus(subCurr, subPrev),
        },
        {
          label: "Visualizações",
          help: "Vídeos assistidos no período",
          value: viewsCurr > 0 ? fmtNum(viewsCurr) : "--",
          status: deltaStatus(viewsCurr, viewsPrev),
        },
        {
          label: "Tempo assistido",
          help: "Horas totais assistidas",
          value: watchCurr > 0 ? fmtHours(watchCurr) : "--",
          status: deltaStatus(watchCurr, watchPrev),
        },
        {
          label: "Engajamento",
          help: "Likes e comentários",
          value: engCurr > 0 ? fmtPct(engCurr) : "--",
          status: deltaStatus(engCurr, engPrev),
        },
      ];
    }
  }

  // ── Instagram ─────────────────────────────────────────────────────────────

  let igRows: MetricRow[] = IG_FALLBACK;

  if (igIds.length > 0) {
    const [{ data: rawProfile }, { data: rawMedia }] = await Promise.all([
      supabase
        .from("dash_gestao_instagram_profile_daily")
        .select("date, account_id, followers_count, reach")
        .in("account_id", igIds)
        .gte("date", previousStart)
        .lte("date", currentEnd)
        .order("date", { ascending: true }),
      supabase
        .from("dash_gestao_instagram_media_daily")
        .select("account_id, media_type, engagement_rate, comments_count, published_at")
        .in("account_id", igIds)
        .gte("published_at", previousStart)
        .lte("published_at", currentEnd),
    ]);

    const allProfile = (rawProfile ?? []) as IgProfileRow[];
    const allMedia = (rawMedia ?? []) as IgMediaRow[];

    const profCurr = allProfile.filter((r) => r.date >= currentStart);
    const profPrev = allProfile.filter((r) => r.date >= previousStart && r.date <= previousEnd);
    const mediaCurr = allMedia.filter((r) => r.published_at >= currentStart);
    const mediaPrev = allMedia.filter((r) => r.published_at >= previousStart && r.published_at <= previousEnd);

    if (profCurr.length > 0 || mediaCurr.length > 0) {
      // Seguidores: latest snapshot per account, summed
      const followersCurr = igIds.reduce((sum, id) => {
        const rows = profCurr.filter((r) => r.account_id === id);
        return sum + (rows.length ? rows[rows.length - 1].followers_count ?? 0 : 0);
      }, 0);
      const followersPrev = igIds.reduce((sum, id) => {
        const rows = profPrev.filter((r) => r.account_id === id);
        return sum + (rows.length ? rows[rows.length - 1].followers_count ?? 0 : 0);
      }, 0);

      // Alcance: sum
      const reachCurr = profCurr.reduce((s, r) => s + (r.reach ?? 0), 0);
      const reachPrev = profPrev.reduce((s, r) => s + (r.reach ?? 0), 0);

      // Engajamento Reels: avg engagement_rate for REEL posts
      const reelsCurr = mediaCurr.filter((r) => r.media_type === "REEL");
      const reelsPrev = mediaPrev.filter((r) => r.media_type === "REEL");
      const engReelsCurr =
        reelsCurr.length > 0
          ? reelsCurr.reduce((s, r) => s + (r.engagement_rate ?? 0), 0) / reelsCurr.length
          : 0;
      const engReelsPrev =
        reelsPrev.length > 0
          ? reelsPrev.reduce((s, r) => s + (r.engagement_rate ?? 0), 0) / reelsPrev.length
          : 0;

      // Comentários: sum
      const commentsCurr = mediaCurr.reduce((s, r) => s + (r.comments_count ?? 0), 0);
      const commentsPrev = mediaPrev.reduce((s, r) => s + (r.comments_count ?? 0), 0);

      igRows = [
        {
          label: "Seguidores",
          help: "Total acumulado do perfil",
          value: followersCurr > 0 ? fmtNum(followersCurr) : "--",
          status: deltaStatus(followersCurr, followersPrev),
        },
        {
          label: "Alcance",
          help: "Contas únicas alcançadas",
          value: reachCurr > 0 ? fmtNum(reachCurr) : "--",
          status: deltaStatus(reachCurr, reachPrev),
        },
        {
          label: "Engajamento Reels",
          help: "Likes e comentários em Reels",
          value: engReelsCurr > 0 ? fmtPct(engReelsCurr) : "--",
          status: deltaStatus(engReelsCurr, engReelsPrev),
        },
        {
          label: "Comentários",
          help: "Total de comentários no período",
          value: commentsCurr > 0 ? String(commentsCurr) : "--",
          status: deltaStatus(commentsCurr, commentsPrev),
        },
      ];
    }
  }

  return { ytRows, igRows };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function PrestarAtencaoPage(): Promise<React.ReactElement> {
  const { ytRows, igRows } = await fetchMetrics();

  const ytScore = calcPlatformScore(ytRows);
  const igScore = calcPlatformScore(igRows);

  const platforms: PlatformHealth[] = [
    { platform: "yt", score: ytScore, status: platformStatus(ytRows), rows: ytRows },
    { platform: "ig", score: igScore, status: platformStatus(igRows), rows: igRows },
  ];

  const pulse = derivePulseBanner(platforms);
  const tiles = deriveTiles(platforms);

  return (
    <div className="main">
      <GvPageHeader
        title="Prestar Atenção"
        sub="Sinais fora do esperado que merecem o seu olhar agora"
      />

      <div className="section">
        <NarrLabel step="01" label="Visão Geral" desc="Saúde consolidada das plataformas" />
        <PulseBanner
          status={pulse.status}
          headline={pulse.headline}
          sub={pulse.sub}
          chips={pulse.chips}
        />

        <NarrLabel step="02" label="Score por Plataforma" />
        <div className="grid g2">
          <HealthCard
            platform="yt"
            name="YouTube"
            score={ytScore}
            status={platforms[0].status}
            headline={
              ytScore === 0
                ? "Dados ainda não configurados"
                : `Score composto: ${ytScore}/100`
            }
            rows={ytRows}
          />
          <HealthCard
            platform="ig"
            name="Instagram"
            score={igScore}
            status={platforms[1].status}
            headline={
              igScore === 0
                ? "Dados ainda não configurados"
                : `Score composto: ${igScore}/100`
            }
            rows={igRows}
          />
        </div>

        <NarrLabel step="03" label="O Que Olhar Primeiro" />
        <div className="cockpit">
          {tiles.map((tile, i) => (
            <CockpitTile
              key={i}
              severity={tile.severity}
              label={tile.label}
              value={tile.value}
              description={tile.description}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
