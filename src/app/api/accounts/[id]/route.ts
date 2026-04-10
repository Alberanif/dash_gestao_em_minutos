import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const { id } = await params;
  const body = await request.json();

  const allowed: Record<string, unknown> = {};
  if (body.name !== undefined) allowed.name = body.name;
  if (body.is_active !== undefined) allowed.is_active = body.is_active;

  const supabase = createSupabaseServiceClient();

  if (body.credentials !== undefined) {
    const incomingCreds = body.credentials as Record<string, unknown>;

    // Buscar plataforma e credenciais existentes do banco (não confiar em body.platform)
    const { data: existingAccount } = await supabase
      .from("dash_gestao_accounts")
      .select("platform, credentials")
      .eq("id", id)
      .single();

    const isYouTube = existingAccount?.platform === "youtube";

    if (isYouTube && incomingCreds.channel_id !== undefined) {
      const channelId = (incomingCreds.channel_id as string).trim();
      if (!channelId) {
        return NextResponse.json({ error: "channel_id não pode ser vazio" }, { status: 400 });
      }
      if (!channelId.startsWith("UC") || channelId.length !== 24) {
        return NextResponse.json(
          { error: "Channel ID inválido. Deve começar com 'UC' e ter 24 caracteres (ex: UCxxxxxxxxxxxxxxxxxxxxxx)." },
          { status: 400 }
        );
      }
      // uploads_playlist_id segue o padrão fixo do YouTube: UC → UU
      incomingCreds.channel_id = channelId;
      incomingCreds.uploads_playlist_id = "UU" + channelId.slice(2);
    }

    // Merge com credenciais existentes para preservar tokens OAuth e outros campos
    const existingCreds = (existingAccount?.credentials ?? {}) as Record<string, unknown>;
    allowed.credentials = { ...existingCreds, ...incomingCreds };
  }

  if (Object.keys(allowed).length === 0) {
    return NextResponse.json({ error: "Nenhum campo válido para atualizar" }, { status: 400 });
  }
  const { data, error: dbError } = await supabase
    .from("dash_gestao_accounts")
    .update(allowed)
    .eq("id", id)
    .select()
    .single();

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const { id } = await params;
  const supabase = createSupabaseServiceClient();

  const { error: dbError } = await supabase
    .from("dash_gestao_accounts")
    .delete()
    .eq("id", id);

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
