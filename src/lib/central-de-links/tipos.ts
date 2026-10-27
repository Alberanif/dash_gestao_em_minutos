/** Tipos de página de um link; a chave é o que fica gravado em `central_links.tipo`. */
export const TIPOS_DE_LINK = {
  cap: "Captação",
  obg: "Obrigado",
  vnd: "Vendas",
  pesq: "Pesquisa",
  aula: "Aula",
  outro: "Outro",
} as const;

export type TipoDeLink = keyof typeof TIPOS_DE_LINK;

export type StatusDeArquivo = "pendente" | "arquivando" | "ok" | "falhou" | "ignorado";

/** Linha de `central_links` (só as colunas que a tela usa). */
export interface LinkDaCentral {
  id: string;
  label: string;
  url: string;
  grupo: string;
  tipo: TipoDeLink;
  deleted: boolean;
  slug: string | null;
  pagina_ativa: boolean;
  arquivo_path: string | null;
  arquivo_tam: number | null;
  arquivado_em: string | null;
  arquivo_status: StatusDeArquivo | null;
  arquivo_erro: string | null;
  arquivo_tentativa_em: string | null;
  /** Imagem da página tirada no arquivamento (bucket `paginas`); null enquanto não houver. */
  miniatura_path?: string | null;
}

/**
 * Linha de `central_grupo_order`. Na V2 cada grupo é uma pasta; `pasta` é o campo antigo (pasta que
 * continha o grupo), que a V2 só preserva. `cor` é a chave da paleta, ou null para a cor padrão.
 */
export interface GrupoDaCentral {
  nome: string;
  position: number;
  pasta: string | null;
  cor?: string | null;
}

/** Linha de `central_pastas`. */
export interface PastaDaCentral {
  nome: string;
  position: number;
}

/** Posição dada a grupo que tem links mas não está em `central_grupo_order`. */
export const POSICAO_SEM_ORDEM = 9999;
