/**
 * Invariantes estáticas da migration 070 (Visualizações, PRD #185).
 *
 * O repo não tem Postgres em teste; lemos o .sql e verificamos as regras que,
 * se quebradas, geram um número errado sem dar erro: fuso em um só lugar,
 * contagem por status, allowlist, segurança das RPCs, idempotência.
 */
import { readFileSync } from "fs";
import { join } from "path";
import type {
  VendasViewDailyRow,
  VendasViewHourlyRow,
  VendasViewKpis,
  VendasViewOfferRow,
} from "@/types/vendas";

const RAW = readFileSync(
  join(process.cwd(), "supabase/migrations/070_vendas_views.sql"),
  "utf8",
);

/** Remove comentários `--` (a prosa cita `at time zone`). */
function stripComments(sql: string): string {
  return sql
    .split("\n")
    .map((l) => l.replace(/--.*$/, ""))
    .join("\n");
}
const SQL = stripComments(RAW);

/** Corpo completo (create ... $$ ... $$;) de uma RPC. */
function fn(name: string): string {
  const re = new RegExp(
    `create or replace function public\\.${name}\\([\\s\\S]*?\\$\\$;`,
  );
  const m = SQL.match(re);
  if (!m) throw new Error(`função ${name} não encontrada`);
  return m[0];
}

function returnColumns(body: string): string[] {
  const m = body.match(/returns table \(([\s\S]*?)\)\s*language/);
  if (!m) throw new Error("returns table não encontrado");
  return m[1]
    .split(",")
    .map((c) => c.trim().split(/\s+/)[0])
    .filter(Boolean);
}

const CONSUMERS = ["kpis", "daily", "hourly", "offers"].map(
  (k) => `dash_gestao_vendas_view_${k}`,
);

describe("migration 070: fuso em um único lugar", () => {
  it("view_sales é o único lugar com `at time zone`", () => {
    expect(fn("dash_gestao_vendas_view_sales")).toMatch(
      /at time zone 'America\/Sao_Paulo'/,
    );
    const outside = SQL.replace(fn("dash_gestao_vendas_view_sales"), "");
    expect(outside).not.toMatch(/at\s+time\s+zone/i);
  });

  it("fora de view_sales não há `::date` nem cast(... as date)", () => {
    const outside = SQL.replace(fn("dash_gestao_vendas_view_sales"), "");
    expect(outside).not.toMatch(/::\s*date\b/i);
    expect(outside).not.toMatch(/\bas\s+date\s*\)/i);
    expect(outside).not.toMatch(/date_trunc/i);
  });

  it.each(CONSUMERS)("%s consome view_sales", (name) => {
    expect(fn(name)).toMatch(/dash_gestao_vendas_view_sales\(p_view_id, p_start, p_end\)/);
  });

  it("daily agrupa por approved_day e hourly por approved_hour", () => {
    expect(fn("dash_gestao_vendas_view_daily")).toMatch(/group by vs\.approved_day/);
    expect(fn("dash_gestao_vendas_view_hourly")).toMatch(/group by vs\.approved_hour/);
  });
});

describe("migration 070: regras de contagem", () => {
  it("view_sales filtra produto + allowlist e exclui oferta nula", () => {
    const b = fn("dash_gestao_vendas_view_sales");
    expect(b).toMatch(/s\.product_id = v\.product_id/);
    expect(b).toMatch(/s\.offer_code = any \(v\.offer_codes\)/);
    expect(b).not.toMatch(/offer_code is null/i);
    expect(b).toMatch(/s\.approved_date is not null/);
  });

  it("view_sales só deixa passar os 4 status conhecidos", () => {
    expect(fn("dash_gestao_vendas_view_sales")).toMatch(
      /s\.status in \('APPROVED', 'COMPLETE', 'REFUNDED', 'CHARGEBACK'\)/,
    );
  });

  it("kpis: principal = APPROVED+COMPLETE, reembolsadas = REFUNDED+CHARGEBACK", () => {
    const b = fn("dash_gestao_vendas_view_kpis");
    expect(b).toMatch(
      /filter \(where vs\.status in \('APPROVED', 'COMPLETE'\)\)\s+as sales/,
    );
    expect(b).toMatch(
      /filter \(where vs\.status in \('REFUNDED', 'CHARGEBACK'\)\)\s+as refunded/,
    );
  });

  it.each(["daily", "hourly"])("%s conta só APPROVED+COMPLETE", (k) => {
    const b = fn(`dash_gestao_vendas_view_${k}`);
    expect(b).toMatch(/vs\.status in \('APPROVED', 'COMPLETE'\)/);
    expect(b).not.toMatch(/REFUNDED|CHARGEBACK/);
  });

  it("offers parte da allowlist (unnest + left join) para devolver ofertas com 0", () => {
    const b = fn("dash_gestao_vendas_view_offers");
    expect(b).toMatch(/unnest\(v\.offer_codes\)/);
    expect(b).toMatch(/left join public\.dash_gestao_vendas_view_sales/);
  });
});

describe("migration 070: segurança e grants", () => {
  it.each(["sales", ...["kpis", "daily", "hourly", "offers"]])(
    "view_%s é security definer com search_path = public",
    (k) => {
      const b = fn(`dash_gestao_vendas_view_${k}`);
      expect(b).toMatch(/security definer/);
      expect(b).toMatch(/set search_path = public/);
      expect(b).toMatch(/\bstable\b/);
    },
  );

  it.each(["sales", "kpis", "daily", "hourly", "offers"])(
    "view_%s: revoke de public/anon/authenticated e grant só a service_role",
    (k) => {
      const sig = `dash_gestao_vendas_view_${k}\\(uuid, date, date\\)`;
      expect(SQL).toMatch(
        new RegExp(`revoke execute on function public\\.${sig}\\s+from public, anon, authenticated`),
      );
      expect(SQL).toMatch(
        new RegExp(`grant\\s+execute on function public\\.${sig}\\s+to service_role`),
      );
    },
  );
});

describe("migration 070: tabela", () => {
  it("allowlist: >= 1, sem duplicados e sem vazio, via check", () => {
    expect(SQL).toMatch(
      /check \(public\.dash_gestao_vendas_offer_codes_valid\(offer_codes\)\)/,
    );
    const v = fn("dash_gestao_vendas_offer_codes_valid");
    expect(v).toMatch(/cardinality\(p_codes\) >= 1/);
    expect(v).toMatch(/count\(distinct c\)/);
  });

  it("product_id é imutável por trigger before update", () => {
    expect(SQL).toMatch(/new\.product_id is distinct from old\.product_id/);
    expect(SQL).toMatch(/before update on public\.dash_gestao_vendas_views/);
    expect(SQL).toMatch(/raise exception/);
  });

  it("sem status/meta/receita; com backfill_status, backfill_from, origem única sem FK", () => {
    const table = SQL.match(
      /create table if not exists public\.dash_gestao_vendas_views \(([\s\S]*?)\n\);/,
    )![1];
    expect(table).not.toMatch(/\bstatus\s+text\b/);
    expect(table).not.toMatch(/goal_percent|counts_new_buyers|purchases_only/);
    expect(table).toMatch(/backfill_status\s+text/);
    expect(table).toMatch(/backfill_from\s+date/);
    expect(table).toMatch(/migrated_from_cycle_id\s+uuid\s+null,/);
    expect(table).not.toMatch(/migrated_from_cycle_id[^,]*references/);
    expect(table).toMatch(/unique \(migrated_from_cycle_id, product_id\)/);
    expect(table).toMatch(/folder_id[^,]*on delete set null/);
  });

  it("RLS ligada com policy de leitura para authenticated", () => {
    expect(SQL).toMatch(
      /alter table public\.dash_gestao_vendas_views enable row level security/,
    );
    expect(SQL).toMatch(/for select\s+to authenticated/);
  });
});

describe("migration 070: migração dos ciclos ativos", () => {
  const mig = SQL.slice(SQL.indexOf("insert into public.dash_gestao_vendas_views"));

  it("só ciclos ativos, só ofertas included = true", () => {
    expect(mig).toMatch(/c\.status = 'ativo'/);
    expect(mig).toMatch(/co\.included is true/);
  });

  it("ignora rejeitadas, offerless e meta", () => {
    const insert = mig.slice(0, mig.indexOf("do $report$"));
    expect(insert).not.toMatch(/rejected|offerless|goal_percent/i);
  });

  it("ciclo/produto sem allowlist não migra (inner join na agregação)", () => {
    expect(mig).toMatch(/\) allow on allow\.cycle_id = c\.id/);
    expect(mig).not.toMatch(/left join[^;]*allow/);
  });

  it("é idempotente e preserva origem, pasta e período", () => {
    expect(mig).toMatch(/on conflict \(migrated_from_cycle_id, product_id\) do nothing/);
    expect(mig).toMatch(/c\.folder_id/);
    expect(mig).toMatch(/c\.view_start_date/);
    expect(mig).toMatch(/c\.view_end_date/);
  });

  it("N>1 produtos nomeia com ' — product_name'", () => {
    expect(mig).toMatch(/pc\.n_products = 1 then c\.name/);
    expect(mig).toMatch(/c\.name \|\| ' — ' \|\| p\.product_name/);
  });

  it("reporta quantos ficaram de fora", () => {
    expect(mig).toMatch(/raise notice/);
  });
});

describe("migration 070: aditiva e idempotente", () => {
  it("não altera nem apaga nada do modelo antigo", () => {
    expect(SQL).not.toMatch(/drop\s+table\s+(if exists\s+)?public\.dash_gestao_vendas_(cycles|buyers|cycle_)/i);
    expect(SQL).not.toMatch(/alter\s+table\s+public\.dash_gestao_vendas_(cycles|buyers|cycle_|manual|excluded)/i);
    expect(SQL).not.toMatch(/(create or replace|drop)\s+function\s+public\.dash_gestao_vendas_(cycle_sales|daily|hourly|roster|purchases)\b/i);
  });

  it("todo DDL é reexecutável", () => {
    expect(SQL).not.toMatch(/\bcreate table (?!if not exists)/i);
    expect(SQL).not.toMatch(/\bcreate (unique )?index (?!if not exists)/i);
    expect(SQL).not.toMatch(/\bcreate function/i);
    expect(SQL).toMatch(/drop trigger if exists trg_vendas_views_guard/);
    expect(SQL).toMatch(/drop policy if exists/);
  });
});

describe("contrato de tipos x colunas das RPCs", () => {
  const kpis: VendasViewKpis = { sales: 0, refunded: 0 };
  const daily: VendasViewDailyRow = { day: "", sales: 0 };
  const hourly: VendasViewHourlyRow = { hour: "", sales: 0 };
  const offers: VendasViewOfferRow = {
    offer_code: "",
    offer_name: null,
    sales: 0,
    refunded: 0,
  };

  it.each([
    ["kpis", kpis],
    ["daily", daily],
    ["hourly", hourly],
    ["offers", offers],
  ])("view_%s: chaves do tipo = colunas do returns table", (k, sample) => {
    const cols = returnColumns(fn(`dash_gestao_vendas_view_${k}`));
    expect(cols).toEqual(Object.keys(sample));
  });
});
