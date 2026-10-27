// Proteção contra SSRF no arquivamento: o servidor nunca busca endereços internos.
// Porte do original (api/arquivar.js), com tudo injetável para testar sem rede.
import dns from "node:dns/promises";
import net from "node:net";
import { FalhaDeArquivamento } from "./arquivamento";

export type Resolvedor = (host: string) => Promise<{ address: string }[]>;

const resolverPadrao: Resolvedor = (host) => dns.lookup(host, { all: true });

export function ipPrivado(ip: string): boolean {
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    if (v === "::1" || v === "::" || v.startsWith("fe80") || v.startsWith("fc") || v.startsWith("fd")) return true;
    const mapeado = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapeado) return ipPrivado(mapeado[1]);
    // O parser de URL normaliza ::ffff:127.0.0.1 para ::ffff:7f00:1 (forma hexadecimal).
    const hex = v.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (hex) {
      const alto = parseInt(hex[1], 16);
      const baixo = parseInt(hex[2], 16);
      return ipPrivado(`${alto >> 8}.${alto & 255}.${baixo >> 8}.${baixo & 255}`);
    }
    return false;
  }
  const p = ip.split(".").map(Number);
  return (
    p[0] === 0 ||
    p[0] === 10 ||
    p[0] === 127 ||
    (p[0] === 100 && p[1] >= 64 && p[1] <= 127) ||
    (p[0] === 169 && p[1] === 254) ||
    (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
    (p[0] === 192 && p[1] === 168) ||
    p[0] >= 224
  );
}

export async function conferirDestino(texto: string, resolver: Resolvedor = resolverPadrao): Promise<URL> {
  let u: URL;
  try {
    u = new URL(texto);
  } catch {
    throw new FalhaDeArquivamento("URL inválida.");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new FalhaDeArquivamento("Só URLs http ou https podem ser arquivadas.");
  }
  if (u.port && u.port !== "80" && u.port !== "443") {
    throw new FalhaDeArquivamento("Porta não permitida.");
  }
  const host = u.hostname.replace(/^\[|\]$/g, "");
  const enderecos = net.isIP(host) ? [{ address: host }] : await resolver(host).catch(() => []);
  if (!enderecos.length) throw new FalhaDeArquivamento("Não foi possível resolver o endereço do site.");
  if (enderecos.some((a) => ipPrivado(a.address))) throw new FalhaDeArquivamento("Endereço não permitido.");
  return u;
}

const MAX_SALTOS = 6;

/** Segue os redirecionamentos conferindo cada destino; devolve o status da resposta final. */
export async function statusDaPagina(
  inicial: string,
  deps: { resolver?: Resolvedor; buscar?: typeof fetch } = {},
): Promise<number> {
  const buscar = deps.buscar ?? fetch;
  let atual = inicial;
  for (let salto = 0; salto < MAX_SALTOS; salto++) {
    const u = await conferirDestino(atual, deps.resolver);
    const r = await buscar(u, {
      redirect: "manual",
      signal: AbortSignal.timeout(20_000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; CentralDeLinks-Arquivador)", Accept: "text/html,*/*" },
    });
    const destino = r.headers.get("location");
    if (r.status >= 300 && r.status < 400 && destino) {
      atual = new URL(destino, u).href;
      continue;
    }
    return r.status;
  }
  throw new FalhaDeArquivamento("Redirecionamentos demais.");
}
