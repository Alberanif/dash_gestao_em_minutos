import type { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { proximaPosicao, type MapaDeGrupos } from "./organizacao";
import { slugDe, slugLivre, slugValido } from "./slug";
import { urlValida } from "./url";
import type {
  GrupoDaCentral,
  LinkDaCentral,
  PastaDaCentral,
  TipoDeLink,
} from "./tipos";

export type Cliente = ReturnType<typeof createSupabaseBrowserClient>;

const SEM_PERMISSAO = "Sem permissão para esta ação.";

interface Resposta<T> {
  data: T | null;
  error: { message: string; code?: string } | null;
}

type LinhaDeGrupo = { grupo: string; position: number; pasta: string | null; cor?: string | null };

// O cliente é tipado por esquema gerado que o projeto não tem; as consultas são montadas por tabela.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const de = (sb: Cliente, tabela: string): any => sb.from(tabela as never);

/** Lança Error em português se o Supabase devolveu erro; devolve os dados. */
async function checar<T>(pedido: PromiseLike<Resposta<T>>, contexto: string): Promise<T> {
  const r = await pedido;
  if (r.error) throw Object.assign(new Error(`${contexto}: ${r.error.message}`), { code: r.error.code });
  return (r.data ?? []) as T;
}

/** Lê uma tabela inteira; o PostgREST devolve no máximo 1.000 linhas por consulta. */
async function lerTabela<T>(
  sb: Cliente,
  tabela: string,
  ordem: string,
  filtro?: (q: any) => any, // eslint-disable-line @typescript-eslint/no-explicit-any
): Promise<T[]> {
  const tudo: T[] = [];
  for (let inicio = 0; ; inicio += 1000) {
    let q = de(sb, tabela).select("*");
    if (filtro) q = filtro(q);
    const pagina = await checar<T[]>(q.order(ordem).range(inicio, inicio + 999), "Erro ao carregar");
    tudo.push(...pagina);
    if (pagina.length < 1000) break;
  }
  return tudo;
}

export async function lerTudo(sb: Cliente): Promise<{
  links: LinkDaCentral[];
  grupos: GrupoDaCentral[];
  pastas: PastaDaCentral[];
}> {
  const [links, linhas, pastas] = await Promise.all([
    lerTabela<LinkDaCentral>(sb, "central_links", "id", (q) => q.eq("deleted", false)),
    lerTabela<LinhaDeGrupo>(sb, "central_grupo_order", "grupo"),
    lerTabela<PastaDaCentral>(sb, "central_pastas", "nome"),
  ]);
  const grupos = linhas.map((g) => ({ nome: g.grupo, position: g.position, pasta: g.pasta, cor: g.cor ?? null }));
  return { links, grupos, pastas };
}

/** Garante que o grupo exista em `central_grupo_order` (solto, no fim dos soltos). */
async function garantirGrupo(sb: Cliente, grupo: string): Promise<void> {
  const linhas = await checar<LinhaDeGrupo[]>(
    de(sb, "central_grupo_order").select("grupo,position,pasta"),
    "Erro ao salvar o grupo",
  );
  const atual = linhas.find((g) => g.grupo === grupo);
  if (atual && atual.position < 9999) return;
  const position = proximaPosicao(linhas.filter((g) => !g.pasta).map((g) => g.position));
  await checar(
    de(sb, "central_grupo_order").upsert(
      { grupo, position, pasta: null },
      { onConflict: "grupo", ignoreDuplicates: true },
    ),
    "Erro ao salvar o grupo",
  );
}

export const LIMITE_ARQUIVO = 50 * 1024 * 1024;

const BUCKET = "paginas";
const SLUG_EM_USO = "Esse endereço já está em uso por outro link.";
const PAGINA_SEM_ARQUIVO = "A página pública precisa de um arquivo arquivado.";

/** A página só pode ficar pública se existe arquivo (já salvo ou prestes a ser enviado). */
export function validarPaginaAtiva(arquivoPath: string | null, temArquivoNovo: boolean): void {
  if (!arquivoPath && !temArquivoNovo) throw new Error(PAGINA_SEM_ARQUIVO);
}

/** Salva o link e devolve o id (novo ou existente). */
export async function salvarLink(
  sb: Cliente,
  dados: {
    id?: string; label: string; url: string; grupo: string; tipo: TipoDeLink;
    slug?: string; paginaAtiva?: boolean;
    /** Só vale em link novo: true = fila de arquivamento (pendente); false = sem cópia (ignorado). */
    arquivoAutomatico?: boolean;
  },
  linksAtuais: LinkDaCentral[],
  temArquivoNovo?: boolean,
): Promise<string> {
  const label = dados.label.trim();
  const url = dados.url.trim();
  const grupo = dados.grupo.trim();
  if (!label || !grupo) throw new Error("Preencha nome e grupo.");
  if (!urlValida(url)) throw new Error("Informe uma URL válida, com http:// ou https://.");
  if (linksAtuais.some((l) => !l.deleted && l.url === url && l.id !== dados.id)) {
    throw new Error("Essa URL já está cadastrada.");
  }
  const slugInformado = dados.slug?.trim();
  if (slugInformado) {
    if (!slugValido(slugInformado)) {
      throw new Error("Endereço inválido: use letras minúsculas, números e hífens.");
    }
    if (linksAtuais.some((l) => l.slug === slugInformado && l.id !== dados.id)) throw new Error(SLUG_EM_USO);
  }
  if (dados.paginaAtiva) {
    const atual = dados.id ? linksAtuais.find((l) => l.id === dados.id) : undefined;
    validarPaginaAtiva(atual?.arquivo_path ?? null, !!temArquivoNovo);
  }

  let id = dados.id;
  let linhaReaproveitada = false;
  const achados = await checar<{ id: string; deleted: boolean }[]>(
    de(sb, "central_links").select("id,deleted").eq("url", url).limit(1),
    "Erro ao salvar o link",
  );
  const dup = achados[0];
  if (dup && dup.id !== dados.id) {
    if (!dup.deleted) throw new Error("Essa URL já está cadastrada.");
    id = dup.id; // reaproveita a linha excluída
    linhaReaproveitada = true;
  }

  const campos: Record<string, unknown> = { label, url, grupo, tipo: dados.tipo, deleted: false };
  if (slugInformado) {
    campos.slug = slugInformado;
  } else if (!id) {
    const ocupados = new Set(linksAtuais.map((l) => l.slug).filter((s): s is string => !!s));
    campos.slug = slugLivre(slugDe(label), ocupados);
  }
  if (dados.paginaAtiva !== undefined) campos.pagina_ativa = dados.paginaAtiva;
  // Edição de link existente nunca mexe no estado do arquivamento.
  if ((!dados.id || linhaReaproveitada) && dados.arquivoAutomatico !== undefined) {
    campos.arquivo_status = dados.arquivoAutomatico ? "pendente" : "ignorado";
  }

  const consulta = id
    ? de(sb, "central_links").update(campos).eq("id", id).select("id")
    : de(sb, "central_links").insert(campos).select("id");
  let r: { id: string }[];
  try {
    r = await checar<{ id: string }[]>(consulta, "Erro ao salvar o link");
  } catch (e) {
    if ((e as { code?: string }).code === "23505") {
      throw new Error(SLUG_EM_USO);
    }
    throw e;
  }
  if (!r.length) throw new Error(SEM_PERMISSAO);

  await garantirGrupo(sb, grupo);
  return r[0].id;
}

/** Re-lê um link (após cada item da fila de arquivamento); null se não existe ou foi excluído. */
export async function lerLink(sb: Cliente, id: string): Promise<LinkDaCentral | null> {
  const r = await checar<LinkDaCentral[]>(
    de(sb, "central_links").select("*").eq("id", id).limit(1),
    "Erro ao carregar o link",
  );
  const l = r[0];
  return l && !l.deleted ? l : null;
}

export async function enviarArquivo(
  sb: Cliente,
  id: string,
  arquivo: File | Blob,
): Promise<{ arquivo_path: string; arquivo_tam: number; arquivado_em: string }> {
  if (arquivo.size > LIMITE_ARQUIVO) throw new Error("O arquivo passa do limite de 50 MB.");
  const caminho = `${id}.html`;
  const up = await sb.storage.from(BUCKET).upload(caminho, arquivo, { upsert: true, contentType: "text/html" });
  if (up.error) throw new Error(`Erro ao enviar o arquivo: ${up.error.message}`);
  const campos = {
    arquivo_path: caminho,
    arquivo_tam: arquivo.size,
    arquivado_em: new Date().toISOString(),
  };
  const r = await checar<{ id: string }[]>(
    de(sb, "central_links")
      .update({ ...campos, arquivo_status: "ok", arquivo_erro: null })
      .eq("id", id)
      .select("id"),
    "Erro ao salvar o arquivo",
  );
  if (!r.length) throw new Error(SEM_PERMISSAO);
  return campos;
}

export async function removerArquivo(
  sb: Cliente,
  id: string,
  arquivoPath: string,
  miniaturaPath?: string | null,
): Promise<void> {
  const rm = await sb.storage.from(BUCKET).remove(miniaturaPath ? [arquivoPath, miniaturaPath] : [arquivoPath]);
  if (rm.error) throw new Error(`Erro ao remover o arquivo: ${rm.error.message}`);
  const r = await checar<{ id: string }[]>(
    de(sb, "central_links")
      .update({
        arquivo_path: null,
        arquivo_tam: null,
        arquivado_em: null,
        arquivo_erro: null,
        pagina_ativa: false,
        arquivo_status: "ignorado",
        // A coluna só existe depois da migration 077: só entra quando há miniatura para limpar.
        ...(miniaturaPath ? { miniatura_path: null } : {}),
      })
      .eq("id", id)
      .select("id"),
    "Erro ao remover o arquivo",
  );
  if (!r.length) throw new Error(SEM_PERMISSAO);
}

export async function baixarCopia(sb: Cliente, arquivoPath: string): Promise<string> {
  const { data, error } = await sb.storage.from(BUCKET).download(arquivoPath);
  if (error || !data) throw new Error(`Erro ao baixar a cópia: ${error?.message ?? "arquivo vazio"}`);
  return data.text();
}

export async function definirPaginaAtiva(
  sb: Cliente,
  id: string,
  ativa: boolean,
  arquivoPath: string | null,
): Promise<void> {
  if (ativa) validarPaginaAtiva(arquivoPath, false);
  const r = await checar<{ id: string }[]>(
    de(sb, "central_links").update({ pagina_ativa: ativa }).eq("id", id).select("id"),
    "Erro ao atualizar a página pública",
  );
  if (!r.length) throw new Error(SEM_PERMISSAO);
}

export async function excluirLink(sb: Cliente, id: string): Promise<void> {
  const r = await checar<{ id: string }[]>(
    de(sb, "central_links").update({ deleted: true, pagina_ativa: false }).eq("id", id).select("id"),
    "Erro ao excluir o link",
  );
  if (!r.length) throw new Error(SEM_PERMISSAO);
}

export async function criarPasta(sb: Cliente, nome: string, pastas: PastaDaCentral[]): Promise<void> {
  const n = nome.trim();
  if (!n) throw new Error("Informe o nome da pasta.");
  if (pastas.some((p) => p.nome.toLowerCase() === n.toLowerCase())) {
    throw new Error("Já existe uma pasta com esse nome.");
  }
  await checar(
    de(sb, "central_pastas").insert({ nome: n, position: proximaPosicao(pastas.map((p) => p.position)) }),
    "Erro ao criar a pasta",
  );
}

export async function excluirPasta(sb: Cliente, nome: string): Promise<void> {
  await checar(
    de(sb, "central_grupo_order").update({ pasta: null }).eq("pasta", nome),
    "Erro ao excluir a pasta",
  );
  const r = await checar<{ nome: string }[]>(
    de(sb, "central_pastas").delete().eq("nome", nome).select("nome"),
    "Erro ao excluir a pasta",
  );
  if (!r.length) throw new Error(SEM_PERMISSAO);
}

/** Coluna ou função da migration 077 ainda ausente no banco (PostgREST ou Postgres). */
function faltaMigration(e: unknown): boolean {
  const code = (e as { code?: string }).code;
  return code === "42703" || code === "PGRST204" || code === "PGRST202" || code === "42883";
}

export const SEM_MIGRATION = "Aplique a migration 077 no Supabase para usar este recurso.";

export async function criarGrupo(
  sb: Cliente,
  nome: string,
  pasta: string | null,
  grupos: MapaDeGrupos | GrupoDaCentral[],
  cor?: string,
): Promise<void> {
  const n = nome.trim();
  if (!n) throw new Error("Informe o nome do grupo.");
  const entradas: { nome: string; position: number; pasta: string | null }[] = Array.isArray(grupos)
    ? grupos
    : Object.entries(grupos).map(([nomeDoGrupo, g]) => ({ nome: nomeDoGrupo, ...g }));
  if (entradas.some((g) => g.nome === n)) throw new Error("Já existe um grupo com esse nome.");
  const posicoes = entradas.filter((g) => (g.pasta ?? null) === pasta).map((g) => g.position);
  const linha = { grupo: n, position: proximaPosicao(posicoes), pasta };
  try {
    await checar(de(sb, "central_grupo_order").insert(cor ? { ...linha, cor } : linha), "Erro ao criar o grupo");
  } catch (e) {
    // Sem a migration 077 não há coluna de cor: a pasta nasce com a cor padrão da tela.
    if (!cor || !faltaMigration(e)) throw e;
    await checar(de(sb, "central_grupo_order").insert(linha), "Erro ao criar o grupo");
  }
}

/** Renomeia a pasta e os links dela de uma vez (função `central_renomear_pasta`, migration 077). */
export async function renomearPasta(sb: Cliente, de_: string, para: string): Promise<void> {
  const r = await (sb as unknown as { rpc: (f: string, a: object) => PromiseLike<Resposta<unknown>> }).rpc(
    "central_renomear_pasta",
    { p_de: de_, p_para: para },
  );
  if (r.error) {
    if (faltaMigration(r.error)) throw new Error(SEM_MIGRATION);
    throw new Error(r.error.message || "Erro ao renomear a pasta.");
  }
}

export async function definirCorDaPasta(sb: Cliente, nome: string, cor: string): Promise<void> {
  let r: { grupo: string }[];
  try {
    r = await checar<{ grupo: string }[]>(
      de(sb, "central_grupo_order").update({ cor }).eq("grupo", nome).select("grupo"),
      "Erro ao mudar a cor",
    );
  } catch (e) {
    if (faltaMigration(e)) throw new Error(SEM_MIGRATION);
    throw e;
  }
  if (!r.length) throw new Error(SEM_PERMISSAO);
}

/** Endereços temporários (1 h) das miniaturas, por caminho. Quem falhar fica de fora: o cartão mostra o espaço ilustrado. */
export async function urlsDeMiniaturas(sb: Cliente, caminhos: string[]): Promise<Record<string, string>> {
  if (!caminhos.length) return {};
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrls(caminhos, 3600);
  if (error || !data) return {};
  const mapa: Record<string, string> = {};
  for (const item of data) if (item.path && item.signedUrl) mapa[item.path] = item.signedUrl;
  return mapa;
}

export async function moverGrupoDePasta(sb: Cliente, nome: string, pasta: string | null): Promise<void> {
  const linhas = await checar<LinhaDeGrupo[]>(
    de(sb, "central_grupo_order").select("grupo,position,pasta"),
    "Erro ao mover o grupo",
  );
  const atual = linhas.find((g) => g.grupo === nome);
  const position =
    atual && (atual.pasta ?? null) === pasta
      ? atual.position
      : proximaPosicao(linhas.filter((g) => (g.pasta ?? null) === pasta).map((g) => g.position));
  await checar(
    de(sb, "central_grupo_order").upsert({ grupo: nome, position, pasta }, { onConflict: "grupo" }),
    "Erro ao mover o grupo",
  );
}

export async function excluirGrupo(sb: Cliente, nome: string, links: LinkDaCentral[]): Promise<void> {
  if (links.some((l) => l.grupo === nome && !l.deleted)) {
    throw new Error("Mova ou exclua os links do grupo antes de excluí-lo.");
  }
  const r = await checar<{ grupo: string }[]>(
    de(sb, "central_grupo_order").delete().eq("grupo", nome).select("grupo"),
    "Erro ao excluir o grupo",
  );
  if (!r.length) throw new Error(SEM_PERMISSAO);
}

export async function reordenarPastas(sb: Cliente, itens: PastaDaCentral[]): Promise<void> {
  await checar(
    de(sb, "central_pastas").upsert(
      itens.map((p) => ({ nome: p.nome, position: p.position })),
      { onConflict: "nome" },
    ),
    "Erro ao reordenar",
  );
}

export async function reordenarGrupos(sb: Cliente, itens: GrupoDaCentral[]): Promise<void> {
  await checar(
    de(sb, "central_grupo_order").upsert(
      itens.map((g) => ({ grupo: g.nome, position: g.position, pasta: g.pasta })),
      { onConflict: "grupo" },
    ),
    "Erro ao reordenar",
  );
}
