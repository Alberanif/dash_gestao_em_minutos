import {
  POSICAO_SEM_ORDEM,
  type GrupoDaCentral,
  type LinkDaCentral,
  type PastaDaCentral,
} from "./tipos";

export type MapaDeGrupos = Record<string, { position: number; pasta: string | null; cor?: string | null }>;

const collator = new Intl.Collator("pt-BR");

function porPosicao(a: { nome: string; position: number }, b: { nome: string; position: number }) {
  return a.position - b.position || collator.compare(a.nome, b.nome);
}

/** Indexa os grupos por nome; grupo que tem link mas não está na lista entra no fim, sem pasta. */
export function montarGrupos(linhas: GrupoDaCentral[], links: LinkDaCentral[]): MapaDeGrupos {
  const mapa: MapaDeGrupos = {};
  for (const g of linhas) mapa[g.nome] = { position: g.position, pasta: g.pasta, cor: g.cor ?? null };
  for (const l of links) {
    if (!mapa[l.grupo]) mapa[l.grupo] = { position: POSICAO_SEM_ORDEM, pasta: null };
  }
  return mapa;
}

/** Nomes dos grupos da pasta, por posição e depois nome. `null` = soltos ou de pasta que não existe mais. */
export function nomesDaPasta(
  grupos: MapaDeGrupos,
  pastas: PastaDaCentral[],
  pasta: string | null,
): string[] {
  const existentes = new Set(pastas.map((p) => p.nome));
  return Object.keys(grupos)
    .filter((n) => {
      const p = grupos[n].pasta;
      return pasta === null ? !p || !existentes.has(p) : p === pasta;
    })
    .map((nome) => ({ nome, position: grupos[nome].position }))
    .sort(porPosicao)
    .map((g) => g.nome);
}

/** Ordem de exibição: cada pasta em ordem, depois os grupos soltos. */
export function ordemDeGrupos(grupos: MapaDeGrupos, pastas: PastaDaCentral[]): string[] {
  const lista: string[] = [];
  for (const p of [...pastas].sort(porPosicao)) lista.push(...nomesDaPasta(grupos, pastas, p.nome));
  lista.push(...nomesDaPasta(grupos, pastas, null));
  return lista;
}

/** Ordem da V2: uma lista só, por posição e depois nome. O campo antigo `pasta` não entra. */
export function ordemDasPastas(grupos: MapaDeGrupos): string[] {
  return Object.keys(grupos)
    .map((nome) => ({ nome, position: grupos[nome].position }))
    .sort(porPosicao)
    .map((g) => g.nome);
}

function porRotulo(a: LinkDaCentral, b: LinkDaCentral) {
  return collator.compare(a.label, b.label);
}

export function linksDoGrupo(links: LinkDaCentral[], nome: string): LinkDaCentral[] {
  return links.filter((l) => l.grupo === nome).sort(porRotulo);
}

export function contarPorGrupo(links: LinkDaCentral[]): Record<string, number> {
  const c: Record<string, number> = {};
  for (const l of links) c[l.grupo] = (c[l.grupo] ?? 0) + 1;
  return c;
}

export function buscarLinks(links: LinkDaCentral[], termo: string): LinkDaCentral[] {
  const t = termo.trim().toLowerCase();
  if (!t) return [...links];
  return links
    .filter((l) => l.label.toLowerCase().includes(t) || l.url.toLowerCase().includes(t))
    .sort(porRotulo);
}

/** Troca o item com o vizinho e reindexa 0..n-1. `null` se já está na borda (ou não existe). */
export function mover<T extends { nome: string; position: number }>(
  itens: T[],
  nome: string,
  direcao: -1 | 1,
): T[] | null {
  const lista = [...itens].sort(porPosicao);
  const i = lista.findIndex((x) => x.nome === nome);
  const j = i + direcao;
  if (i < 0 || j < 0 || j >= lista.length) return null;
  [lista[i], lista[j]] = [lista[j], lista[i]];
  return lista.map((x, k) => ({ ...x, position: k }));
}

/** Próxima posição livre: maior posição (ignorando as sem ordem) + 1; vazio = 0. */
export function proximaPosicao(posicoes: number[]): number {
  return posicoes.reduce((m, p) => (p >= POSICAO_SEM_ORDEM ? m : Math.max(m, p)), -1) + 1;
}
