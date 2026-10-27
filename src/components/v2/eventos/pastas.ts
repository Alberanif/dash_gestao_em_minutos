import type { FilterRecord, FilterStatus } from "@/types/indicadores";
import { hexDaCor, type CorPasta } from "./pastas-regras";
import type { PastaUsuario } from "./pastas-servidor";

export interface PastaConfig {
  id: string;
  nome: string;
  descricao: string;
  /** Classes do marcador da pasta: a cor escolhida pelo usuário, vinda de `--pc`. */
  marcador: string;
  cor: CorPasta;
  hex: string;
}

/** Status é só do dashboard: aparece no cartão do evento, não organiza pastas. O âmbar (ponto) marca só o que está vivo agora. */
const ESTADOS: Record<FilterStatus, { rotulo: string; marcador: string }> = {
  ativo: { rotulo: "Ativo", marcador: "bg-v2-ponto shadow-v2-brilho-ponto" },
  finalizado: { rotulo: "Finalizado", marcador: "bg-v2-azul-luz" },
  cancelado: { rotulo: "Cancelado", marcador: "bg-v2-queda" },
};

export function estadoDoEvento(status: FilterStatus): { rotulo: string; marcador: string } {
  return ESTADOS[status] ?? ESTADOS.ativo;
}

export function pastaDoUsuario(p: PastaUsuario): PastaConfig {
  return {
    id: p.id,
    nome: p.nome,
    descricao: "Pasta criada por você",
    marcador: "bg-[var(--pc)]",
    cor: p.cor,
    hex: hexDaCor(p.cor),
  };
}

/** Eventos de uma pasta, já filtrados pela lista recebida (a busca entra aqui). */
export function eventosDaPasta(pasta: PastaConfig, filtros: FilterRecord[], usuario: readonly PastaUsuario[]): FilterRecord[] {
  const ids = new Set(usuario.find((u) => u.id === pasta.id)?.eventoIds ?? []);
  return filtros.filter((f) => ids.has(f.id));
}

/** Eventos que não estão em nenhuma pasta do usuário. */
export function eventosSemPasta(filtros: FilterRecord[], usuario: readonly PastaUsuario[]): FilterRecord[] {
  const guardados = new Set(usuario.flatMap((u) => u.eventoIds));
  return filtros.filter((f) => !guardados.has(f.id));
}

export const POR_FILEIRA = 3;

/**
 * Lugar de cada casa da fileira (0 a 2) quando uma pasta está aberta: com a fileira cheia, a aberta
 * vai para o meio e as outras seguem na ordem de sempre. Fileira incompleta fica como está.
 */
export function colunasDaFileira(chaves: readonly string[], aberta: string | null): number[] {
  if (chaves.length !== POR_FILEIRA || aberta === null || !chaves.includes(aberta)) return chaves.map((_, i) => i);
  const livres = [0, 2];
  return chaves.map((c) => (c === aberta ? 1 : (livres.shift() as number)));
}

/** Destino do dashboard do evento (entregue pela #259). */
export function hrefDoEvento(id: string): string {
  return `/v2/indicadores/${id}`;
}
