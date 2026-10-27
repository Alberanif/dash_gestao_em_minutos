/** Apelido do endereço público a partir do nome: minúsculas, sem acento, hífens, até 60 caracteres. */
export function slugDe(label: string): string {
  return String(label)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function slugValido(s: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s);
}

/** Primeiro apelido livre a partir de `base`: base, base-2, base-3... Base vazia vira "pagina". */
export function slugLivre(base: string, ocupados: ReadonlySet<string>): string {
  const cand = base || "pagina";
  let slug = cand;
  let n = 1;
  while (ocupados.has(slug)) {
    n++;
    slug = `${cand}-${n}`;
  }
  return slug;
}
