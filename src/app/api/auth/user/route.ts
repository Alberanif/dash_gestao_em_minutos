import { NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";

export async function GET() {
  const { error, userId } = await validateApiAuth();
  if (error) return error;

  return NextResponse.json({ id: userId });
}
