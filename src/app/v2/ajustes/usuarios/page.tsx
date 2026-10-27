import type { Metadata } from "next";
import { PaginaAjustes } from "@/components/v2/ajustes/pagina";
import { GestaoDeUsuarios } from "@/components/v2/ajustes/usuarios/gestao-de-usuarios";

export const metadata: Metadata = { title: "Usuários e acessos" };

export default function UsuariosAjustesV2Page() {
  return (
    <PaginaAjustes titulo="Usuários e acessos" subtitulo="Quem pode entrar no painel e com qual função">
      <GestaoDeUsuarios />
    </PaginaAjustes>
  );
}
