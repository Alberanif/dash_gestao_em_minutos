import { NextResponse } from "next/server";

// Deprecated: use /api/cron/collect instead
export async function POST() {
  return NextResponse.json(
    { error: "Esta rota foi substituída por /api/cron/collect" },
    { status: 410 }
  );
}
