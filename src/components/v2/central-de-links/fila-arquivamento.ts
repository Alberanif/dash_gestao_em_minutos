import type { LinkDaCentral } from "@/lib/central-de-links/tipos";

/** Mesma tolerância do servidor: depois disso a trava de "arquivando" é considerada órfã. */
const TRAVA_OBSOLETA_MS = 6 * 60_000;

export type ResultadoDoItem = { ok: boolean; erro?: string };

export interface ResultadoDaFila {
  feitos: number;
  falhas: number;
  parou: boolean;
  erros: { id: string; erro: string }[];
}

/** Links na fila: `pendente`, ainda sem cópia e não excluídos. */
export function pendentesParaArquivar(links: LinkDaCentral[]): LinkDaCentral[] {
  return links.filter((l) => !l.deleted && l.arquivo_status === "pendente" && !l.arquivo_path);
}

/** "Arquivando" há mais de 6 minutos (ou sem data) é trava órfã: a pessoa pode tentar de novo. */
export function precisaTentarDeNovo(link: LinkDaCentral, agora: Date): boolean {
  if (link.arquivo_status !== "arquivando") return false;
  if (!link.arquivo_tentativa_em) return true;
  return agora.getTime() - new Date(link.arquivo_tentativa_em).getTime() > TRAVA_OBSOLETA_MS;
}

function textoDoErro(e: unknown): string {
  return e instanceof Error && e.message ? e.message : "Não foi possível arquivar a página.";
}

/** Processa os ids UM por vez, segue após erro e para quando `deveParar()` for verdadeiro. */
export async function executarFila(
  ids: string[],
  arquivarUm: (id: string) => Promise<ResultadoDoItem>,
  opcoes: {
    aoTerminarItem?: (id: string, resultado: ResultadoDoItem) => void | Promise<void>;
    deveParar?: () => boolean;
  } = {},
): Promise<ResultadoDaFila> {
  const r: ResultadoDaFila = { feitos: 0, falhas: 0, parou: false, erros: [] };
  for (const id of ids) {
    if (opcoes.deveParar?.()) {
      r.parou = true;
      break;
    }
    let res: ResultadoDoItem;
    try {
      res = await arquivarUm(id);
    } catch (e) {
      res = { ok: false, erro: textoDoErro(e) };
    }
    if (res.ok) {
      r.feitos++;
    } else {
      r.falhas++;
      r.erros.push({ id, erro: res.erro ?? "Não foi possível arquivar a página." });
    }
    try {
      await opcoes.aoTerminarItem?.(id, res);
    } catch {
      // reler o cartão é cosmético: a fila segue
    }
  }
  return r;
}

/** Pede ao servidor para arquivar um link (sessão por cookie; a URL vem do banco, nunca do cliente). */
export async function arquivarNoServidor(id: string, buscar: typeof fetch = (...a) => fetch(...a)): Promise<ResultadoDoItem> {
  let resp: Response;
  try {
    resp = await buscar("/api/central-de-links/arquivar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ id }),
    });
  } catch {
    return { ok: false, erro: "Não foi possível conectar ao servidor. Verifique a rede e tente de novo." };
  }
  if (resp.ok) return { ok: true };
  let erro = `O servidor respondeu com erro ${resp.status}.`;
  try {
    const corpo = (await resp.json()) as { erro?: unknown };
    if (typeof corpo.erro === "string" && corpo.erro) erro = corpo.erro;
  } catch {
    // corpo não era JSON: fica a mensagem com o status
  }
  return { ok: false, erro };
}

/** O servidor sinaliza falta do Chromium com esta frase; a tela explica em vez de repetir falha por falha. */
export function navegadorIndisponivel(erros: { id: string; erro: string }[]): boolean {
  return erros.some((e) => e.erro.includes("navegador de captura não está disponível"));
}
