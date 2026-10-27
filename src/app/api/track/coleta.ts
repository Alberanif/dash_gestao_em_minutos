// Núcleo da coleta pública do Teste A/B (porte de api/track.js). A rota (route.ts) só faz o transporte.
import { normalizarUrl } from "@/lib/central-de-links/ab";

export const TIPOS = ["pageview", "form_inicio", "lead"] as const;
export type TipoEvento = (typeof TIPOS)[number];
export const MAX_CORPO = 4096;
export const CACHE_MS = 10 * 1000;
export const JANELA_MS = 60 * 1000;
export const LIMITE_VISITANTE = 60; // eventos por minuto
export const LIMITE_IP = 240;

// Limite de taxa em memória, por instância: não é global entre instâncias, serve de freio contra
// rajadas. O IP fica só aqui, na memória; nunca vai ao banco.
const contagens = new Map<string, { inicio: number; n: number }>();

export function estourou(chave: string, limite: number): boolean {
  const agora = Date.now();
  if (contagens.size > 5000) {
    for (const [k, v] of contagens) if (agora - v.inicio > JANELA_MS) contagens.delete(k);
  }
  let c = contagens.get(chave);
  if (!c || agora - c.inicio > JANELA_MS) {
    c = { inicio: agora, n: 0 };
    contagens.set(chave, c);
  }
  c.n++;
  return c.n > limite;
}

export function resetarContagens() {
  contagens.clear();
}

const ID = /^[A-Za-z0-9_-]{8,64}$/;

function texto(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().slice(0, max);
  return s || null;
}

export type EventoValido = {
  evento_id: string;
  visitante_id: string;
  tipo: TipoEvento;
  url: string;
  novo_visitante: boolean;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
};

/** Devolve o corpo limpo ou null se for inválido. */
export function validar(b: unknown): EventoValido | null {
  if (!b || typeof b !== "object" || Array.isArray(b)) return null;
  const o = b as Record<string, unknown>;
  if (typeof o.evento_id !== "string" || !ID.test(o.evento_id)) return null;
  if (typeof o.visitante_id !== "string" || !ID.test(o.visitante_id)) return null;
  if (typeof o.tipo !== "string" || !(TIPOS as readonly string[]).includes(o.tipo)) return null;
  if (typeof o.url !== "string" || o.url.length > 2048) return null;
  if (o.novo_visitante !== undefined && typeof o.novo_visitante !== "boolean") return null;
  return {
    evento_id: o.evento_id,
    visitante_id: o.visitante_id,
    tipo: o.tipo as TipoEvento,
    url: o.url,
    novo_visitante: o.novo_visitante === true,
    referrer: texto(o.referrer, 2048),
    utm_source: texto(o.utm_source, 200),
    utm_medium: texto(o.utm_medium, 200),
    utm_campaign: texto(o.utm_campaign, 200),
    utm_content: texto(o.utm_content, 200),
    utm_term: texto(o.utm_term, 200),
  };
}

export function hostDe(t: string): string | null {
  const n = normalizarUrl(t);
  return n ? n.split("/")[0] : null;
}

export type VarianteAtiva = {
  variante_id: string;
  teste_id: string;
  link_id: string;
  url: string;
  iniciado_em: number;
};

export type LinhaVariante = {
  id: string;
  teste_id: string;
  link_id: string;
  central_links: { url: string } | { url: string }[];
  ab_testes: { iniciado_em: string | null } | { iniciado_em: string | null }[];
};

const um = <T,>(v: T | T[]): T => (Array.isArray(v) ? v[0] : v);

export function paraVariantesAtivas(rows: LinhaVariante[]): VarianteAtiva[] {
  return rows
    .map((v) => {
      const teste = um(v.ab_testes);
      return {
        variante_id: v.id,
        teste_id: v.teste_id,
        link_id: v.link_id,
        url: normalizarUrl(um(v.central_links).url) as string,
        iniciado_em: teste.iniciado_em ? new Date(teste.iniciado_em).getTime() : 0,
      };
    })
    .filter((v) => v.url);
}

// variantes de testes ativos (URL do link já normalizada), em cache curto
let cache: { em: number; itens: VarianteAtiva[] | null } = { em: 0, itens: null };

export async function variantesAtivas(buscar: () => Promise<LinhaVariante[]>): Promise<VarianteAtiva[]> {
  if (cache.itens && Date.now() - cache.em < CACHE_MS) return cache.itens;
  const itens = paraVariantesAtivas(await buscar());
  cache = { em: Date.now(), itens };
  return itens;
}

export function resetarCache() {
  cache = { em: 0, itens: null };
}
