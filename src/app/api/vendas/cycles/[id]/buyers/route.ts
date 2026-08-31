import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

type Params = { id: string };

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_ROWS = 20_000;

type UploadMode = "preview" | "commit";

interface BuyerRowInput {
  email?: unknown;
  name?: unknown;
  phone?: unknown;
  extra?: unknown;
}

interface InvalidRow {
  index: number;
  email?: string;
  reason: string;
}

interface NormalizedRow {
  index: number;
  email: string;
  name: string | null;
  phone: string | null;
  extra: Record<string, unknown>;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateRows(rows: unknown[]): { valid: NormalizedRow[]; invalidRows: InvalidRow[] } {
  const valid: NormalizedRow[] = [];
  const invalidRows: InvalidRow[] = [];

  rows.forEach((rawRow, index) => {
    if (!isPlainObject(rawRow)) {
      invalidRows.push({ index, reason: "linha inválida" });
      return;
    }

    const row = rawRow as BuyerRowInput;
    const rawEmail = row.email;

    if (typeof rawEmail !== "string" || rawEmail.trim() === "") {
      invalidRows.push({ index, reason: "email ausente" });
      return;
    }

    const email = rawEmail.trim().toLowerCase();
    if (!EMAIL_REGEX.test(email)) {
      invalidRows.push({ index, email, reason: "email inválido" });
      return;
    }

    if (row.name !== undefined && row.name !== null && typeof row.name !== "string") {
      invalidRows.push({ index, email, reason: "name inválido" });
      return;
    }

    if (row.phone !== undefined && row.phone !== null && typeof row.phone !== "string") {
      invalidRows.push({ index, email, reason: "phone inválido" });
      return;
    }

    if (row.extra !== undefined && row.extra !== null && !isPlainObject(row.extra)) {
      invalidRows.push({ index, email, reason: "extra inválido" });
      return;
    }

    valid.push({
      index,
      email,
      name: (row.name as string | null | undefined) ?? null,
      phone: (row.phone as string | null | undefined) ?? null,
      extra: (row.extra as Record<string, unknown> | undefined) ?? {},
    });
  });

  return { valid, invalidRows };
}

function dedupe(valid: NormalizedRow[]): { rows: NormalizedRow[]; duplicates: string[] } {
  const counts = new Map<string, number>();
  const byEmail = new Map<string, NormalizedRow>();

  for (const row of valid) {
    counts.set(row.email, (counts.get(row.email) ?? 0) + 1);
    byEmail.set(row.email, row); // última ocorrência vence
  }

  const duplicates = [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([email]) => email);

  return { rows: [...byEmail.values()], duplicates };
}

export async function POST(request: NextRequest, { params }: { params: Promise<Params> }) {
  const { error } = await requireRole(["gestor"]);
  if (error) return error;

  const { id } = await params;
  const supabase = createSupabaseServiceClient();

  const { data: cycle, error: cycleError } = await supabase
    .from("dash_gestao_vendas_cycles")
    .select("id, status")
    .eq("id", id)
    .single();

  if (cycleError) {
    if (cycleError.code === "PGRST116") {
      return NextResponse.json({ error: "Ciclo não encontrado" }, { status: 404 });
    }
    return NextResponse.json({ error: cycleError.message }, { status: 500 });
  }

  if (!cycle) {
    return NextResponse.json({ error: "Ciclo não encontrado" }, { status: 404 });
  }

  if (cycle.status === "encerrado") {
    return NextResponse.json({ error: "Ciclo encerrado" }, { status: 409 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!isPlainObject(body)) {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }

  const { mode, rows } = body as { mode?: unknown; rows?: unknown };

  if (mode !== "preview" && mode !== "commit") {
    return NextResponse.json({ error: "mode deve ser 'preview' ou 'commit'" }, { status: 400 });
  }

  if (!Array.isArray(rows)) {
    return NextResponse.json({ error: "rows deve ser um array" }, { status: 400 });
  }

  if (rows.length > MAX_ROWS) {
    return NextResponse.json({ error: `rows excede o limite de ${MAX_ROWS} linhas` }, { status: 400 });
  }

  const { valid, invalidRows } = validateRows(rows);
  const { rows: dedupedRows, duplicates } = dedupe(valid);

  const uploadMode = mode as UploadMode;

  if (uploadMode === "preview") {
    const { data: currentBuyers, error: buyersError } = await supabase
      .from("dash_gestao_vendas_buyers")
      .select("email")
      .eq("cycle_id", id);

    if (buyersError) {
      return NextResponse.json({ error: buyersError.message }, { status: 500 });
    }

    const currentEmails = new Set(
      (currentBuyers ?? []).map((row: { email: string }) => row.email.trim().toLowerCase())
    );
    const newEmails = new Set(dedupedRows.map((row) => row.email));

    const leaving = [...currentEmails].filter((email) => !newEmails.has(email));
    const entering = [...newEmails].filter((email) => !currentEmails.has(email));

    return NextResponse.json({
      currentCount: currentEmails.size,
      newCount: newEmails.size,
      leaving,
      entering,
      invalidRows,
      duplicates,
    });
  }

  // Commit com zero linhas válidas apagaria a base inteira do ciclo (e os
  // manual_links em cascata, sem volta). Upload vazio é sempre erro de
  // parsing/operação — nunca intenção; rejeita antes de tocar o banco.
  if (dedupedRows.length === 0) {
    return NextResponse.json(
      { error: "Nenhuma linha válida no upload — commit abortado para não apagar a base atual", invalidRows, duplicates },
      { status: 400 }
    );
  }

  const { data: rpcData, error: rpcError } = await supabase.rpc("dash_gestao_vendas_replace_buyers", {
    p_cycle_id: id,
    p_rows: dedupedRows.map(({ email, name, phone, extra }) => ({ email, name, phone, extra })),
  });

  if (rpcError) {
    return NextResponse.json({ error: rpcError.message }, { status: 500 });
  }

  const result = (Array.isArray(rpcData) ? rpcData[0] : rpcData) as
    | { removed: number; updated: number; inserted: number }
    | undefined;

  return NextResponse.json({
    removed: result?.removed ?? 0,
    updated: result?.updated ?? 0,
    inserted: result?.inserted ?? 0,
    invalidRows,
    duplicates,
  });
}
