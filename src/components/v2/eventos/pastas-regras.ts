/**
 * Regras das pastas do usuário. Vale para o cliente (diálogo) e para o servidor (ações):
 * o banco repete nome (1 a 30 caracteres) e cores em constraints.
 */

export const NOME_PASTA_MAX = 30;
export const LIMITE_PASTAS = 24;

/** Paleta fixa: tons que combinam com o tema escuro. O âmbar fica de fora: é só o dado vivo. */
export const PALETA = [
  { chave: "azul", nome: "Azul", hex: "#2e8bb9" },
  { chave: "ciano", nome: "Ciano", hex: "#1fa7b8" },
  { chave: "verde", nome: "Verde", hex: "#2f9e6e" },
  { chave: "indigo", nome: "Índigo", hex: "#4a63d6" },
  { chave: "violeta", nome: "Violeta", hex: "#7b6fe0" },
  { chave: "rosa", nome: "Rosa", hex: "#c4568f" },
  { chave: "coral", nome: "Coral", hex: "#d9604f" },
  { chave: "ardosia", nome: "Ardósia", hex: "#5b7a94" },
] as const;

export type CorPasta = (typeof PALETA)[number]["chave"];

export const COR_PADRAO: CorPasta = "azul";

export function ehCorPasta(valor: unknown): valor is CorPasta {
  return PALETA.some((c) => c.chave === valor);
}

export function hexDaCor(cor: CorPasta): string {
  return (PALETA.find((c) => c.chave === cor) ?? PALETA[0]).hex;
}

export function nomeDaCor(cor: CorPasta): string {
  return (PALETA.find((c) => c.chave === cor) ?? PALETA[0]).nome;
}

/** Nome sem espaços nas pontas e com espaços internos repetidos reduzidos a um. */
export function normalizarNomePasta(nome: string): string {
  return nome.replace(/\s+/g, " ").trim();
}

export function chaveDeNome(nome: string): string {
  return normalizarNomePasta(nome).toLocaleLowerCase("pt-BR");
}

/** Devolve a mensagem do problema, ou null se o nome serve. `outras` são os nomes das demais pastas. */
export function erroDoNomePasta(nome: string, outras: readonly string[]): string | null {
  const limpo = normalizarNomePasta(nome);
  if (limpo === "") return "Dê um nome à pasta.";
  if (limpo.length > NOME_PASTA_MAX) return `Use até ${NOME_PASTA_MAX} caracteres.`;
  const chave = chaveDeNome(limpo);
  if (outras.some((o) => chaveDeNome(o) === chave)) return "Já existe uma pasta com esse nome.";
  return null;
}

export type ResultadoAcao<T extends object = object> =({ ok: true } & T) | { ok: false; erro: string };

/** Ações de servidor entregues pela página; nos testes entram como mocks. */
export interface AcoesPastas {
  criar(nome: string, cor: CorPasta): Promise<ResultadoAcao<{ id: string }>>;
  atualizar(id: string, nome: string, cor: CorPasta): Promise<ResultadoAcao>;
  excluir(id: string): Promise<ResultadoAcao>;
  definirPastasDoEvento(eventoId: string, pastaIds: string[]): Promise<ResultadoAcao>;
}
