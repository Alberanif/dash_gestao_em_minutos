import Image from "next/image";
import Link from "next/link";
import { CartaoGiro, type CartaoDoMenu } from "../menu-principal/cartao-giro";

/** Ícones de traço fino, como os do menu principal. */
const TRACO = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

const ICONE_DADOS = (
  <svg {...TRACO}>
    <ellipse cx="12" cy="5" rx="8" ry="3" />
    <path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
    <path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
  </svg>
);

const ICONE_CONTAS = (
  <svg {...TRACO}>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  </svg>
);

const ICONE_USUARIOS = (
  <svg {...TRACO}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5" />
    <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8" />
    <path d="M18 14.8c1.9.6 3.1 2.3 3.5 5.2" />
  </svg>
);

/** Dados é a tela do dia a dia e a mais pesada: o cartão grande. Contas e Usuários ficam empilhados ao lado. */
export const CARTOES_DE_AJUSTES: readonly CartaoDoMenu[] = [
  {
    id: "dados",
    href: "/v2/ajustes/dados",
    titulo: "Dados e sincronização",
    icone: ICONE_DADOS,
    descricao: "Sincronize plataformas, rode coletas em lote e acompanhe o histórico",
    destaque: "#7da7d9",
    tamanho: "grande",
  },
  {
    id: "contas",
    href: "/v2/ajustes/contas",
    titulo: "Contas conectadas",
    icone: ICONE_CONTAS,
    descricao: "YouTube, Instagram, Hotmart e Meta Ads ligados ao painel",
    destaque: "#8fb3a3",
    tamanho: "pequeno",
  },
  {
    id: "usuarios",
    href: "/v2/ajustes/usuarios",
    titulo: "Usuários e acessos",
    icone: ICONE_USUARIOS,
    descricao: "Quem entra no painel, com qual função, e as solicitações pendentes",
    destaque: "#a99bb8",
    tamanho: "pequeno",
  },
];

/** Hub de Ajustes da V2: mesmo cabeçalho e cartões com giro do menu principal. */
export function HubAjustes() {
  return (
    <div className="v2-menu-pagina">
      <header className="v2-menu-cabecalho">
        <Image src="/igt-logo.png" alt="IGT" width={64} height={64} priority className="v2-menu-logo" />
        <h1 className="v2-menu-titulo">Configurações</h1>
      </header>
      <nav aria-label="Ajustes" className="v2-menu v2-menu--alto">
        {CARTOES_DE_AJUSTES.map((c) => (
          <CartaoGiro key={c.id} c={c} />
        ))}
      </nav>
      <Link
        href="/v2"
        className="inline-flex items-center gap-1.5 rounded-v2-sm text-sm font-medium text-v2-azul-luz focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-v2-azul-luz"
      >
        <span aria-hidden="true">←</span> Voltar ao menu
      </Link>
    </div>
  );
}
