// src/app/api/youtube/videos/route.ts
import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const accountId = request.nextUrl.searchParams.get("account_id");
  if (!accountId) {
    return NextResponse.json({ error: "account_id é obrigatório" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();

  const startDate = request.nextUrl.searchParams.get("start_date")?.slice(0, 10);
  const endDate = request.nextUrl.searchParams.get("end_date")?.slice(0, 10);

  // Fetch daily rows in the requested period
  let metricsQuery = supabase
    .from("dash_gestao_youtube_video_daily")
    .select(
      "video_id, views, estimated_minutes_watched, average_view_duration, average_view_percentage, likes, comments"
    )
    .eq("account_id", accountId);

  if (startDate) metricsQuery = metricsQuery.gte("date", startDate);
  if (endDate) metricsQuery = metricsQuery.lte("date", endDate);

  const { data: dailyRows, error: dailyError } = await metricsQuery;
  if (dailyError) {
    return NextResponse.json({ error: dailyError.message }, { status: 500 });
  }

  if (!dailyRows || dailyRows.length === 0) {
    return NextResponse.json([]);
  }

  // Fetch metadata for the video_ids that appear in the period
  const videoIds = [...new Set(dailyRows.map((r) => r.video_id))];
  let metaQuery = supabase
    .from("dash_gestao_youtube_videos")
    .select("video_id, title, published_at, thumbnail_url, duration")
    .eq("account_id", accountId)
    .in("video_id", videoIds);

  if (startDate) metaQuery = metaQuery.gte("published_at", startDate);
  if (endDate) metaQuery = metaQuery.lte("published_at", endDate);

  const { data: metaRows, error: metaError } = await metaQuery;

  if (metaError) {
    return NextResponse.json({ error: metaError.message }, { status: 500 });
  }

  const metaMap = new Map(
    (metaRows ?? []).map((m) => [m.video_id, m])
  );

  // Aggregate daily rows by video_id
  const videoMap = new Map<
    string,
    {
      video_id: string;
      title: string;
      published_at: string;
      thumbnail_url: string;
      duration: string;
      total_views: number;
      total_watch_min: number;
      sum_view_pct: number;
      sum_view_dur: number;
      total_likes: number;
      total_comments: number;
      days_count: number;
    }
  >();

  for (const row of dailyRows) {
    const meta = metaMap.get(row.video_id);
    if (!videoMap.has(row.video_id)) {
      videoMap.set(row.video_id, {
        video_id: row.video_id,
        title: meta?.title ?? row.video_id,
        published_at: meta?.published_at ?? "",
        thumbnail_url: meta?.thumbnail_url ?? "",
        duration: meta?.duration ?? "",
        total_views: 0,
        total_watch_min: 0,
        sum_view_pct: 0,
        sum_view_dur: 0,
        total_likes: 0,
        total_comments: 0,
        days_count: 0,
      });
    }
    const v = videoMap.get(row.video_id)!;
    v.total_views += Number(row.views ?? 0);
    v.total_watch_min += Number(row.estimated_minutes_watched ?? 0);
    v.sum_view_pct += Number(row.average_view_percentage ?? 0);
    v.sum_view_dur += Number(row.average_view_duration ?? 0);
    v.total_likes += Number(row.likes ?? 0);
    v.total_comments += Number(row.comments ?? 0);
    v.days_count += 1;
  }

  const videos = Array.from(videoMap.values())
    .map((v) => ({
      video_id: v.video_id,
      title: v.title,
      published_at: v.published_at,
      thumbnail_url: v.thumbnail_url,
      duration: v.duration,
      total_views: v.total_views,
      total_watch_min: v.total_watch_min,
      avg_view_percentage:
        v.days_count > 0 ? v.sum_view_pct / v.days_count : 0,
      avg_view_duration:
        v.days_count > 0 ? v.sum_view_dur / v.days_count : 0,
      total_likes: v.total_likes,
      total_comments: v.total_comments,
    }))
    .sort((a, b) => b.total_views - a.total_views);

  return NextResponse.json(videos);
}
