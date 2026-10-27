/**
 * Testa o snippet public/t.js rodando num contexto `vm` com DOM falso mínimo. Cobre a lógica;
 * o comportamento num navegador real continua sendo verificação manual.
 */
import fs from "fs";
import path from "path";
import vm from "vm";

const codigo = fs.readFileSync(path.join(process.cwd(), "public", "t.js"), "utf8");

type Corpo = Record<string, unknown>;
type Envio = { u: string; c: Corpo; via?: string };
type Ouvinte = (ev: unknown) => void;

function ambiente(
  opcoes: {
    search?: string;
    local?: Record<string, string>;
    beacon?: boolean;
    origem?: string;
    dataOrigem?: string | null;
    referrer?: string;
    cookie?: string;
  } = {},
) {
  const { search = "", local = {}, beacon = true, origem = "https://central.exemplo.com", referrer = "" } = opcoes;
  const enviados: Envio[] = [];
  const docL: Record<string, Ouvinte[]> = {};
  const script = {
    src: origem + "/t.js",
    getAttribute: (n: string) => (n === "data-origem" ? (opcoes.dataOrigem ?? null) : null),
  };
  const doc = {
    currentScript: script,
    cookie: opcoes.cookie ?? "",
    referrer,
    addEventListener(t: string, fn: Ouvinte) {
      (docL[t] = docL[t] || []).push(fn);
    },
  };
  const armazem: Record<string, string> = { ...local };
  let n = 0;
  const ctx: Record<string, unknown> = {
    document: doc,
    location: { href: "https://pagina.com/oferta?" + search, search: search ? "?" + search : "" },
    localStorage: {
      getItem: (k: string) => (k in armazem ? armazem[k] : null),
      setItem: (k: string, v: string) => {
        armazem[k] = v;
      },
    },
    navigator: {
      sendBeacon: beacon
        ? (u: string, c: string) => {
            enviados.push({ u, c: JSON.parse(c) });
            return true;
          }
        : undefined,
    },
    fetch: (u: string, o: { body: string }) => {
      enviados.push({ u, c: JSON.parse(o.body), via: "fetch" });
      return Promise.resolve();
    },
    crypto: { randomUUID: () => "id-" + String(++n).padStart(8, "0") },
    URL,
    URLSearchParams,
    JSON,
    Math,
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(codigo, ctx);
  return { enviados, docL, armazem, doc };
}

function formFalso(cancelar: boolean) {
  const fl: { fn: Ouvinte; once: boolean }[] = [];
  const f = {
    addEventListener(t: string, fn: Ouvinte, opts?: { once?: boolean }) {
      if (t === "submit") fl.push({ fn, once: !!(opts && opts.once) });
    },
    closest: (s: string) => (s === "form._form, form[data-ab-form]" ? f : null),
  };
  return {
    f,
    enviar(docL: Record<string, Ouvinte[]>) {
      const ev = { target: f, defaultPrevented: false };
      (docL.submit || []).forEach((fn) => fn(ev)); // captura no documento
      if (cancelar) ev.defaultPrevented = true; // a validação da página cancela
      fl.splice(0).forEach((l) => {
        l.fn(ev);
        if (!l.once) fl.push(l);
      });
    },
  };
}

const tipos = (a: { enviados: Envio[] }) => a.enviados.map((x) => x.c.tipo);

describe("public/t.js", () => {
  it("envia pageview na carga, com url, utms, referrer e novo_visitante", () => {
    const a = ambiente({ search: "utm_source=fb&utm_campaign=x", referrer: "https://google.com/" });
    expect(a.enviados).toHaveLength(1);
    const e = a.enviados[0];
    expect(e.u).toBe("https://central.exemplo.com/api/track");
    expect(e.c.tipo).toBe("pageview");
    expect(e.c.novo_visitante).toBe(true);
    expect(e.c.utm_source).toBe("fb");
    expect(e.c.utm_campaign).toBe("x");
    expect(e.c.utm_medium).toBeUndefined();
    expect(e.c.referrer).toBe("https://google.com/");
    expect(e.c.url).toBe("https://pagina.com/oferta?utm_source=fb&utm_campaign=x");
    expect(e.c.visitante_id).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    expect(e.c.evento_id).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
  });

  it("guarda o ID anônimo ab_vid em localStorage e em cookie", () => {
    const a = ambiente();
    const id = a.enviados[0].c.visitante_id as string;
    expect(a.armazem.ab_vid).toBe(id);
    expect(a.doc.cookie).toContain("ab_vid=" + id);
  });

  it("reaproveita o ID do cookie quando o localStorage está vazio", () => {
    const a = ambiente({ cookie: "x=1; ab_vid=cookie-visitante-1" });
    expect(a.enviados[0].c.visitante_id).toBe("cookie-visitante-1");
    expect(a.enviados[0].c.novo_visitante).toBe(false);
  });

  it("segunda visita do mesmo navegador conta como retorno", () => {
    const a = ambiente({ local: { ab_vid: "visitante-antigo-1" } });
    expect(a.enviados[0].c.novo_visitante).toBe(false);
    expect(a.enviados[0].c.visitante_id).toBe("visitante-antigo-1");
  });

  it("lê a origem de data-origem antes do src, sem barra final", () => {
    const a = ambiente({ dataOrigem: "https://outro.exemplo.com/" });
    expect(a.enviados[0].u).toBe("https://outro.exemplo.com/api/track");
  });

  it("form_inicio sai uma vez só e ignora campos ocultos", () => {
    const a = ambiente();
    const f = formFalso(false).f;
    const campo = { tagName: "INPUT", type: "text", closest: () => f };
    const oculto = { tagName: "INPUT", type: "hidden", closest: () => f };
    a.docL.focusin.forEach((fn) => fn({ target: oculto }));
    expect(tipos(a)).toEqual(["pageview"]);
    a.docL.focusin.forEach((fn) => fn({ target: campo }));
    a.docL.focusin.forEach((fn) => fn({ target: campo }));
    expect(a.enviados.filter((x) => x.c.tipo === "form_inicio")).toHaveLength(1);
  });

  it("não conta foco em campo fora de formulário rastreado", () => {
    const a = ambiente();
    const campo = { tagName: "INPUT", type: "text", closest: () => null };
    a.docL.focusin.forEach((fn) => fn({ target: campo }));
    expect(tipos(a)).toEqual(["pageview"]);
  });

  it("submit válido gera lead", () => {
    const a = ambiente();
    formFalso(false).enviar(a.docL);
    expect(a.enviados.filter((x) => x.c.tipo === "lead")).toHaveLength(1);
  });

  it("cada submit válido gera um lead só (o tratador é de uso único)", () => {
    const a = ambiente();
    const form = formFalso(false);
    form.enviar(a.docL);
    form.enviar(a.docL);
    expect(a.enviados.filter((x) => x.c.tipo === "lead")).toHaveLength(2);
  });

  it("submit cancelado pela validação não gera lead", () => {
    const a = ambiente();
    formFalso(true).enviar(a.docL);
    expect(a.enviados.filter((x) => x.c.tipo === "lead")).toHaveLength(0);
    expect(tipos(a)).toEqual(["pageview"]);
  });

  it("com sendBeacon disponível não usa fetch", () => {
    expect(ambiente().enviados[0].via).toBeUndefined();
  });

  it("sem sendBeacon usa fetch keepalive", () => {
    const a = ambiente({ beacon: false });
    expect(a.enviados[0].via).toBe("fetch");
  });

  it("não quebra com API fora do ar nem sem origem", () => {
    expect(() => ambiente({ beacon: false })).not.toThrow();
    const ctx = { document: { currentScript: null, addEventListener() {} }, location: {} };
    vm.createContext(ctx);
    expect(() => vm.runInContext(codigo, ctx)).not.toThrow();
  });

  it("é JS puro ES5-seguro e pequeno", () => {
    expect(Buffer.byteLength(codigo)).toBeLessThan(5000);
    expect(codigo).not.toMatch(/=>|\bconst\b|\blet\b|`/);
  });
});
