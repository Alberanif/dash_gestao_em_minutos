/**
 * Invariantes estáticas da migration 072 (Visualização com vários produtos,
 * PRD #213 / issue #214). Sem Postgres em teste: lemos os .sql e checamos as
 * regras que, quebradas, dão número errado sem erro.
 */
import { readFileSync } from "fs";
import { join } from "path";
import type { VendasViewOfferRow, VendasViewProduct, VendasViewRecord } from "@/types/vendas";

function load(file: string): string {
  return readFileSync(join(process.cwd(), "supabase/migrations", file), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}
function stripComments(sql: string): string {
  return sql
    .split("\n")
    .map((l) => l.replace(/--.*$/, ""))
    .join("\n");
}

const SQL070 = stripComments(load("070_vendas_views.sql"));
const SQL = stripComments(load("072_vendas_views_multi_produto.sql"));

function fnOf(sql: string, name: string): string {
  const re = new RegExp(
    `create (?:or replace )?function public\\.${name}\\([\\s\\S]*?(?:\\$\\$|\\$fn\\$);(?=\\s|$)`,
  );
  const m = sql.match(re);
  if (!m) throw new Error(`função ${name} não encontrada`);
  return m[0];
}
const fn = (name: string) => fnOf(SQL, name);

function returnColumns(body: string): string[] {
  const m = body.match(/returns table \(([\s\S]*?)\)\s*language/);
  if (!m) throw new Error("returns table não encontrado");
  return m[1]
    .split(",")
    .map((c) => c.trim().split(/\s+/)[0])
    .filter(Boolean);
}

/** Normaliza espaços para comparar corpos de função. */
const squash = (s: string) => s.replace(/\s+/g, " ").trim();

describe("migration 072: tabela filha", () => {
  const table = SQL.match(
    /create table if not exists public\.dash_gestao_vendas_view_products \(([\s\S]*?)\n\);/,
  )![1];

  it("FKs: view (cascade) e hotmart_products; unique(view_id, product_id)", () => {
    expect(table).toMatch(/view_id\s+uuid\s+not null references public\.dash_gestao_vendas_views\(id\) on delete cascade/);
    expect(table).toMatch(/product_id\s+text\s+not null references public\.dash_gestao_hotmart_products\(product_id\)/);
    expect(table).toMatch(/unique \(view_id, product_id\)/);
  });

  it("CHECK de allowlist por linha reaproveita offer_codes_valid", () => {
    expect(table).toMatch(
      /check \(public\.dash_gestao_vendas_offer_codes_valid\(offer_codes\)\)/,
    );
    expect(table).toMatch(/offer_codes\s+text\[\]\s+not null/);
  });

  it("RLS ligada com leitura para authenticated, como a 070", () => {
    expect(SQL).toMatch(
      /alter table public\.dash_gestao_vendas_view_products enable row level security/,
    );
    expect(SQL).toMatch(/on public\.dash_gestao_vendas_view_products\s+for select\s+to authenticated/);
  });
});

describe("migration 072: colunas antigas e cópia", () => {
  it("relaxa product_id e offer_codes para NULL, sem apagar as colunas", () => {
    expect(SQL).toMatch(/alter column product_id\s+drop not null/);
    expect(SQL).toMatch(/alter column offer_codes drop not null/);
    expect(SQL).not.toMatch(/drop column/i);
  });

  it("recria o check da 070 aceitando NULL (a função reprova NULL)", () => {
    expect(SQL).toMatch(/drop constraint if exists chk_vendas_views_offer_codes/);
    expect(SQL).toMatch(/check \(offer_codes is null or public\.dash_gestao_vendas_offer_codes_valid\(offer_codes\)\)/);
  });

  it("copia cada visualização para 1 linha filha, sem duplicar nem ressuscitar produto removido", () => {
    const ins = SQL.slice(
      SQL.indexOf("insert into public.dash_gestao_vendas_view_products"),
      SQL.indexOf("create or replace function public.dash_gestao_vendas_views_guard"),
    );
    expect(ins).toMatch(/select v\.id, v\.product_id, v\.offer_codes/);
    expect(ins).toMatch(/and not exists \(\s*select 1 from public\.dash_gestao_vendas_view_products vp where vp\.view_id = v\.id/);
    expect(ins).toMatch(/on conflict \(view_id, product_id\) do nothing/);
  });
});

describe("migration 072: mínimo de 1 produto no lugar da imutabilidade", () => {
  it("o guard não bloqueia mais a troca de product_id, mas mantém updated_at", () => {
    const g = fn("dash_gestao_vendas_views_guard");
    expect(g).not.toMatch(/raise exception/);
    expect(g).not.toMatch(/product_id/);
    expect(g).toMatch(/new\.updated_at := now\(\)/);
  });

  it("constraint trigger deferido recusa visualização que ficaria sem produto", () => {
    const f = fn("dash_gestao_vendas_view_products_min_one");
    expect(f).toMatch(/raise exception/);
    expect(f).toMatch(/not exists \(\s*select 1 from public\.dash_gestao_vendas_view_products where view_id = old\.view_id/);
    // apagar a própria visualização (cascade) não pode ser bloqueado
    expect(f).toMatch(/exists \(select 1 from public\.dash_gestao_vendas_views where id = old\.view_id\)/);
    expect(SQL).toMatch(/create constraint trigger trg_vendas_view_products_min_one/);
    expect(SQL).toMatch(/after delete or update of view_id on public\.dash_gestao_vendas_view_products\s+deferrable initially deferred/);
  });
});

describe("migration 072: view_sales", () => {
  const b = fn("dash_gestao_vendas_view_sales");
  const old = fnOf(SQL070, "dash_gestao_vendas_view_sales");

  it("junta pela tabela filha por produto + allowlist do próprio produto", () => {
    expect(b).toMatch(/from public\.dash_gestao_vendas_view_products vp/);
    expect(b).toMatch(/s\.product_id = vp\.product_id/);
    expect(b).toMatch(/s\.offer_code = any \(vp\.offer_codes\)/);
    expect(b).toMatch(/where vp\.view_id = p_view_id/);
    expect(b).not.toMatch(/dash_gestao_vendas_views\b/);
    expect(b).not.toMatch(/v\.offer_codes|v\.product_id/);
  });

  it("equivalência com a 070: mesmos filtros, mesmo fuso, só muda a origem e ganha product_id", () => {
    const tail = (s: string) => squash(s.slice(s.indexOf("and s.approved_date is not null")));
    expect(tail(b)).toBe(tail(old));
    const head = (s: string) => squash(s.slice(s.indexOf("s.transaction_code"), s.indexOf("from public.")));
    // 070 não tem o product_id no select; o resto é idêntico
    expect(head(b)).toBe(head(old).replace(/\) as approved_hour$/, ") as approved_hour, s.product_id"));
  });

  it("uma venda não é contada duas vezes: 1 linha filha por (view, produto) e s.product_id fixo", () => {
    expect(SQL).toMatch(/unique \(view_id, product_id\)/);
    // o join por offer_code vem sempre depois do por product_id
    expect(squash(b)).toMatch(/on s\.product_id = vp\.product_id and s\.offer_code = any/);
    expect(b.match(/join public\.dash_gestao_hotmart_sales s/g)).toHaveLength(1);
  });

  it("devolve product_id como última coluna", () => {
    expect(returnColumns(b)).toEqual([
      "transaction_code",
      "offer_code",
      "status",
      "approved_date",
      "approved_day",
      "approved_hour",
      "product_id",
    ]);
  });

  it("é recriada por drop + create (o retorno mudou)", () => {
    expect(SQL).toMatch(/drop function if exists public\.dash_gestao_vendas_view_sales\(uuid, date, date\);\s*create function/);
  });
});

describe("migration 072: fuso só em view_sales", () => {
  it("`at time zone`, `::date` e date_trunc só aparecem em view_sales", () => {
    const outside = SQL.replace(fn("dash_gestao_vendas_view_sales"), "");
    expect(outside).not.toMatch(/at\s+time\s+zone/i);
    expect(outside).not.toMatch(/::\s*date\b/i);
    expect(outside).not.toMatch(/\bas\s+date\s*\)/i);
    expect(outside).not.toMatch(/date_trunc/i);
  });

  it.each(["kpis", "daily", "hourly", "offers"])("view_%s consome view_sales", (k) => {
    expect(fn(`dash_gestao_vendas_view_${k}`)).toMatch(
      /dash_gestao_vendas_view_sales\(p_view_id, p_start, p_end\)/,
    );
  });
});

describe("migration 072: kpis/daily/hourly mantêm assinatura e corpo", () => {
  it.each([
    ["kpis", ["sales", "refunded"]],
    ["daily", ["day", "sales"]],
    ["hourly", ["hour", "sales"]],
  ])("view_%s: mesmas colunas e mesmo corpo da 070", (k, cols) => {
    const name = `dash_gestao_vendas_view_${k}`;
    expect(returnColumns(fn(name))).toEqual(cols);
    expect(squash(fn(name))).toBe(squash(fnOf(SQL070, name)));
  });
});

describe("migration 072: view_offers", () => {
  const b = fn("dash_gestao_vendas_view_offers");

  it("colunas: product_id e product_name novos, no início", () => {
    expect(returnColumns(b)).toEqual([
      "product_id",
      "product_name",
      "offer_code",
      "offer_name",
      "sales",
      "refunded",
    ]);
  });

  it("uma linha por (produto, oferta): unnest da filha + left join; vendas casam por produto E oferta", () => {
    expect(b).toMatch(/from public\.dash_gestao_vendas_view_products vp/);
    expect(b).toMatch(/unnest\(vp\.offer_codes\)/);
    expect(b).toMatch(/left join public\.dash_gestao_vendas_view_sales\(p_view_id, p_start, p_end\) vs\s+on vs\.product_id = vp\.product_id\s+and vs\.offer_code = a\.code/);
    expect(b).toMatch(/group by vp\.product_id, p\.product_name, a\.code, o\.offer_name/);
  });

  it("nome da oferta é resolvido dentro do produto", () => {
    expect(b).toMatch(/o\.product_id = vp\.product_id/);
  });

  it("é recriada por drop + create (o retorno mudou)", () => {
    expect(SQL).toMatch(/drop function if exists public\.dash_gestao_vendas_view_offers\(uuid, date, date\);\s*create function/);
  });

  it("contrato de tipo: chaves de VendasViewOfferRow = colunas", () => {
    const row: VendasViewOfferRow = {
      product_id: "",
      product_name: "",
      offer_code: "",
      offer_name: null,
      sales: 0,
      refunded: 0,
    };
    expect(returnColumns(b)).toEqual(Object.keys(row));
  });
});

describe("migration 072: segurança e idempotência", () => {
  it.each(["sales", "kpis", "daily", "hourly", "offers"])(
    "view_%s: security definer, search_path, revoke e grant só a service_role",
    (k) => {
      const b = fn(`dash_gestao_vendas_view_${k}`);
      expect(b).toMatch(/security definer/);
      expect(b).toMatch(/set search_path = public/);
      expect(b).toMatch(/\bstable\b/);
      const sig = `dash_gestao_vendas_view_${k}\\(uuid, date, date\\)`;
      expect(SQL).toMatch(
        new RegExp(`revoke execute on function public\\.${sig}\\s+from public, anon, authenticated`),
      );
      expect(SQL).toMatch(new RegExp(`grant\\s+execute on function public\\.${sig}\\s+to service_role`));
    },
  );

  it("todo DDL é reexecutável", () => {
    expect(SQL).not.toMatch(/\bcreate table (?!if not exists)/i);
    expect(SQL).not.toMatch(/\bcreate (unique )?index (?!if not exists)/i);
    expect(SQL).not.toMatch(/\bcreate function public\.(?!dash_gestao_vendas_view_(sales|offers)\b)/i);
    expect(SQL).toMatch(/drop trigger if exists trg_vendas_view_products_min_one/);
    expect(SQL).toMatch(/drop policy if exists/);
  });

  it("aditiva: não apaga tabela/coluna nem mexe no modelo antigo", () => {
    expect(SQL).not.toMatch(/drop\s+table/i);
    expect(SQL).not.toMatch(/alter\s+table\s+public\.dash_gestao_vendas_(cycles|buyers|cycle_|manual|excluded)/i);
  });
});

describe("tipos", () => {
  it("VendasViewRecord carrega products: VendasViewProduct[]", () => {
    const p: VendasViewProduct = { product_id: "p", offer_codes: ["o"] };
    const keys: (keyof VendasViewRecord)[] = ["products"];
    expect(p).toEqual({ product_id: "p", offer_codes: ["o"] });
    expect(keys).toContain("products");
  });
});
