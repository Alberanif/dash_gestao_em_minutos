/** Endereço público de uma página arquivada: `/p/<slug>` ou, sem apelido, `/p/<id>`. */
export function enderecoPublico(origem: string, link: { id: string; slug: string | null }): string {
  return `${origem}/p/${link.slug || link.id}`;
}
