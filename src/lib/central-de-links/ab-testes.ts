/**
 * Regras puras da administração dos testes A/B (porte de api/ab-testes.js da Central original).
 * Nada aqui fala com o banco: a rota lê os dados e chama estas funções para decidir.
 */

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MIN_VARIANTES = 2;
export const MAX_VARIANTES = 8;

/** Erro de regra de negócio: a rota o converte em `{ erro: mensagem }` com o `status`. */
export class ErroDeRegra extends Error {
  readonly status: number;
  readonly mensagem: string;
  constructor(status: number, mensagem: string) {
    super(mensagem);
    this.name = "ErroDeRegra";
    this.status = status;
    this.mensagem = mensagem;
  }
}

export type StatusTeste = "rascunho" | "ativo" | "encerrado";

export interface VarianteLimpa {
  link_id: string;
  rotulo: string;
  controle: boolean;
}

export interface DadosValidados {
  nome: string;
  variantes: VarianteLimpa[];
}

export interface TesteParaRegra {
  id: string;
  status: string;
  ab_variantes?: { id: string; link_id: string; controle: boolean }[] | null;
}

export interface LinhaDeLink {
  id: string;
  label: string;
  tipo: string;
  deleted: boolean;
}

type Objeto = Record<string, unknown>;

/** Valida nome e variantes vindos do cliente e devolve a forma limpa. */
export function validarDados(corpo: unknown): DadosValidados {
  const c: Objeto = corpo && typeof corpo === "object" ? (corpo as Objeto) : {};
  const nome = String(c.nome ?? "").trim();
  if (!nome) throw new ErroDeRegra(400, "Informe o nome do teste.");
  if (nome.length > 120) throw new ErroDeRegra(400, "O nome do teste pode ter no máximo 120 caracteres.");

  const lista = Array.isArray(c.variantes) ? (c.variantes as unknown[]) : [];
  if (lista.length < MIN_VARIANTES) throw new ErroDeRegra(400, "Escolha pelo menos 2 páginas para comparar.");
  if (lista.length > MAX_VARIANTES) {
    throw new ErroDeRegra(400, "Um teste pode ter no máximo " + MAX_VARIANTES + " variantes.");
  }

  const links = new Set<string>();
  const rotulos = new Set<string>();
  const variantes = lista.map((item) => {
    const v: Objeto = item && typeof item === "object" ? (item as Objeto) : {};
    const linkId = String(v.link_id ?? "");
    const rotulo = String(v.rotulo ?? "").trim();
    if (!UUID.test(linkId)) throw new ErroDeRegra(400, "Página inválida em uma das variantes.");
    if (!rotulo) throw new ErroDeRegra(400, "Cada variante precisa de um rótulo (A, B, C…).");
    if (rotulo.length > 20) throw new ErroDeRegra(400, "O rótulo da variante pode ter no máximo 20 caracteres.");
    if (links.has(linkId.toLowerCase())) {
      throw new ErroDeRegra(400, "A mesma página não pode aparecer duas vezes no teste.");
    }
    if (rotulos.has(rotulo.toLowerCase())) {
      throw new ErroDeRegra(400, "Os rótulos das variantes precisam ser diferentes.");
    }
    links.add(linkId.toLowerCase());
    rotulos.add(rotulo.toLowerCase());
    return { link_id: linkId.toLowerCase(), rotulo, controle: v.controle === true };
  });

  if (variantes.filter((v) => v.controle).length !== 1) {
    throw new ErroDeRegra(400, "Marque exatamente uma variante como controle.");
  }
  return { nome, variantes };
}

/** O id do teste precisa ser um uuid. */
export function validarIdTeste(id: unknown): string {
  const texto = String(id ?? "");
  if (!UUID.test(texto)) throw new ErroDeRegra(400, "Teste inválido.");
  return texto;
}

/** Os links precisam existir, ser do tipo "cap" e não estar excluídos. */
export function conferirLinks(ids: string[], linhas: LinhaDeLink[] | null | undefined): void {
  const porId = new Map((linhas ?? []).map((l) => [l.id.toLowerCase(), l]));
  for (const id of ids) {
    const l = porId.get(id.toLowerCase());
    if (!l || l.deleted) throw new ErroDeRegra(400, "Uma das páginas escolhidas não existe mais.");
    if (l.tipo !== "cap") throw new ErroDeRegra(400, 'A página "' + l.label + '" não é uma página de captura.');
  }
}

/** Só rascunho pode ser editado. */
export function checarEdicao(teste: TesteParaRegra): void {
  if (teste.status !== "rascunho") {
    throw new ErroDeRegra(409, "Só é possível editar um teste que ainda não foi iniciado.");
  }
}

/** Iniciar exige rascunho, 2+ variantes e exatamente 1 controle. */
export function checarInicio(teste: TesteParaRegra): void {
  if (teste.status !== "rascunho") throw new ErroDeRegra(409, "Este teste já foi iniciado ou encerrado.");
  const variantes = teste.ab_variantes ?? [];
  if (variantes.length < MIN_VARIANTES) {
    throw new ErroDeRegra(400, "O teste precisa de pelo menos 2 páginas para ser iniciado.");
  }
  if (variantes.filter((v) => v.controle).length !== 1) {
    throw new ErroDeRegra(400, "Marque uma variante como controle antes de iniciar.");
  }
}

export const MSG_INICIO_CONCORRENTE = "Este teste já foi iniciado ou encerrado.";
export const MSG_ENCERRAMENTO_CONCORRENTE = "Só é possível encerrar um teste que está em andamento.";

/**
 * Encerrar: só teste ativo. Vencedor = id de uma variante do teste ou vazio ("sem diferença").
 * Devolve os campos a gravar.
 */
export function montarEncerramento(
  teste: TesteParaRegra,
  corpo: Objeto,
  agora: Date = new Date(),
): { status: "encerrado"; encerrado_em: string; vencedor_variante: string | null; anotacao: string | null } {
  if (teste.status !== "ativo") throw new ErroDeRegra(409, MSG_ENCERRAMENTO_CONCORRENTE);

  let vencedor: string | null = null;
  if (corpo.vencedor_variante) {
    vencedor = String(corpo.vencedor_variante).toLowerCase();
    if (!(teste.ab_variantes ?? []).some((v) => v.id.toLowerCase() === vencedor)) {
      throw new ErroDeRegra(400, "A variante vencedora não pertence a este teste.");
    }
  }
  const anotacao = String(corpo.anotacao ?? "").trim();
  if (anotacao.length > 2000) throw new ErroDeRegra(400, "A anotação pode ter no máximo 2000 caracteres.");

  return {
    status: "encerrado",
    encerrado_em: agora.toISOString(),
    vencedor_variante: vencedor,
    anotacao: anotacao || null,
  };
}

/** Excluir: nunca um teste ativo; encerrado só com `confirmar: true`. */
export function checarExclusao(teste: TesteParaRegra, corpo: Objeto): void {
  if (teste.status === "ativo") throw new ErroDeRegra(409, "Encerre o teste antes de excluí-lo.");
  if (teste.status === "encerrado" && corpo.confirmar !== true) {
    throw new ErroDeRegra(
      400,
      "Excluir um teste encerrado apaga todo o histórico dele. Confirme a exclusão.",
    );
  }
}

/** Erro do PostgREST: 23505 (gatilho/unique) vira 409 com a mensagem do banco, que já é em português. */
export function erroDoBanco(erro: { code?: string; message?: string } | null | undefined): ErroDeRegra {
  if (erro && erro.code === "23505") {
    return new ErroDeRegra(409, erro.message || "Já existe um registro igual a este.");
  }
  return new ErroDeRegra(500, "Erro ao acessar o banco de dados.");
}
