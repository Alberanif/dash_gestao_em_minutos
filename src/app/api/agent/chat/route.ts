import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { streamAgentResponse } from "@/lib/agent/graph";

export async function POST(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const body = await request.json();
  const { message, history, context } = body;

  if (!message) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  // Extract session cookie for server-to-server auth in tool calls
  const cookieHeader = request.headers.get("cookie") ?? "";
  const authHeaders = { cookie: cookieHeader };

  const stream = await streamAgentResponse({
    message,
    history: history ?? [],
    context,
    authHeaders,
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    },
  });
}
