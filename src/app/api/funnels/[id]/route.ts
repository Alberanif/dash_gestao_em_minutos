import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const { id } = await params;
  const body = await request.json();
  const { name, type, start_date, end_date, goal_sales, config } = body;

  if (!name || !type || !start_date || !end_date || !goal_sales || !config) {
    return NextResponse.json(
      { error: "name, type, start_date, end_date, goal_sales e config são obrigatórios" },
      { status: 400 }
    );
  }

  if (new Date(end_date) <= new Date(start_date)) {
    return NextResponse.json(
      { error: "end_date deve ser posterior a start_date" },
      { status: 400 }
    );
  }

  const supabase = createSupabaseServiceClient();
  const { data, error: dbError } = await supabase
    .from("dash_gestao_funnels")
    .update({
      name,
      type,
      start_date,
      end_date,
      goal_sales,
      config,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Funil não encontrado" }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const { id } = await params;
  const supabase = createSupabaseServiceClient();

  const { error: dbError } = await supabase
    .from("dash_gestao_funnels")
    .delete()
    .eq("id", id);

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
