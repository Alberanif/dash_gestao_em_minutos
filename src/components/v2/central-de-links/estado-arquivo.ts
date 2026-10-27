import type { TomDoSelo } from "../ui";
import type { LinkDaCentral } from "@/lib/central-de-links/tipos";

export interface EstadoDoArquivo {
  tom: TomDoSelo;
  texto: string;
  /** Linha de apoio (tamanho e data da cópia). */
  detalhe?: string;
}

function tamanho(n: number | null): string {
  if (!n) return "0 KB";
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

function dataBR(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "";
}

/** Estado de leitura do arquivamento de um link (neste bloco a tela só mostra; os botões vêm depois). */
export function estadoDoArquivo(l: LinkDaCentral): EstadoDoArquivo {
  if (l.arquivo_path) {
    const partes = [`Página arquivada · ${tamanho(l.arquivo_tam)}`, dataBR(l.arquivado_em)].filter(Boolean);
    return {
      tom: l.pagina_ativa ? "ok" : "neutro",
      texto: l.pagina_ativa ? "Pública ativa" : "Pública inativa",
      detalhe: partes.join(" · "),
    };
  }
  switch (l.arquivo_status) {
    case "arquivando":
      return { tom: "aviso", texto: "Arquivando…" };
    case "falhou":
      return { tom: "erro", texto: l.arquivo_erro ? `Falhou: ${l.arquivo_erro}` : "Falhou" };
    case "ignorado":
      return { tom: "neutro", texto: "Sem cópia arquivada" };
    default:
      return { tom: "aviso", texto: "Aguardando arquivamento" };
  }
}
