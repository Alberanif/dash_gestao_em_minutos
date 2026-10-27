import { podeVer, type PapelCentral } from "@/lib/central-de-links/papel";

export type ItemDoMenu = {
  id: string;
  titulo: string;
  descricao: string;
  href: string;
  /** Qual miniatura o card desenha. */
  arte: "funis" | "testes-ab";
  /** O card só aparece para quem tem papel na Central de Links (`central_role`). */
  exigeCentral?: boolean;
};

/** Itens do menu principal de /v2/indicadores. */
export const ITENS_DO_MENU: readonly ItemDoMenu[] = [
  {
    id: "funis",
    titulo: "Funis",
    descricao: "Acompanhe cada evento: leads, vendas e conversão.",
    href: "/v2/indicadores/eventos",
    arte: "funis",
  },
  {
    id: "testes-ab",
    titulo: "Testes A/B",
    descricao: "Compare versões de uma página e veja qual converte mais.",
    href: "/v2/indicadores/testes-ab",
    arte: "testes-ab",
    exigeCentral: true,
  },
];

/** Os itens que o usuário pode ver: os que exigem a Central somem sem `central_role`. */
export function itensVisiveis(papel: PapelCentral | null): readonly ItemDoMenu[] {
  return ITENS_DO_MENU.filter((i) => !i.exigeCentral || podeVer(papel));
}
