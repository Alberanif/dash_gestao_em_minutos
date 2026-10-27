"use client";

import type { PapelCentral } from "@/lib/central-de-links/papel";
import type { UserRole } from "@/types/auth";
import { Button, Select, Selo, Surface } from "../../ui";
import {
  formatarData,
  nomeDe,
  OPCOES_ACESSO_CENTRAL,
  ROTULO_ACESSO_CENTRAL,
  ROTULO_FUNCAO,
  TOM_ACESSO_CENTRAL,
  TOM_FUNCAO,
  type Usuario,
} from "./tipos";

/**
 * Usuários com acesso. A própria conta (currentUserId) não tem ações: ninguém altera a própria
 * função nem se exclui, e a API também recusa.
 */
export function ListaDeUsuarios({
  usuarios,
  usuarioAtualId,
  onAlterarFuncao,
  onExcluir,
  podeGerirCentral = false,
  onAlterarAcesso,
  acessoSalvandoId = null,
  erroAcesso = null,
}: {
  usuarios: Usuario[];
  usuarioAtualId: string | null;
  onAlterarFuncao: (u: Usuario) => void;
  onExcluir: (u: Usuario) => void;
  /** Só o admin da Central vê o seletor de acesso. */
  podeGerirCentral?: boolean;
  onAlterarAcesso?: (u: Usuario, papel: PapelCentral | null) => void;
  acessoSalvandoId?: string | null;
  erroAcesso?: { usuarioId: string; mensagem: string } | null;
}) {
  return (
    <Surface className="v2-entra p-0" style={{ "--i": 2 } as React.CSSProperties}>
      <ul className="m-0 flex list-none flex-col p-0" aria-label="Usuários com acesso">
        {usuarios.map((u) => {
          const propria = u.id === usuarioAtualId;
          const funcao = u.role as UserRole;
          const chaveAcesso = u.central_role ?? "nenhum";
          return (
            <li
              key={u.id}
              className="flex flex-col gap-3 border-b border-v2-nevoa/10 p-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                {u.name && <p className="m-0 truncate text-sm font-medium">{u.name}</p>}
                <p className={u.name ? "m-0 break-all text-xs text-v2-nevoa/65" : "m-0 break-all text-sm font-medium"}>
                  {u.email}
                </p>
                <p className="m-0 mt-0.5 text-xs text-v2-nevoa/55">
                  Cadastrado em {formatarData(u.created_at)}
                  {u.last_sign_in_at && <> · Último acesso: {formatarData(u.last_sign_in_at)}</>}
                </p>
                {erroAcesso?.usuarioId === u.id && (
                  <p role="alert" className="m-0 mt-1 text-xs text-v2-queda">
                    {erroAcesso.mensagem}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                <Selo tom={TOM_FUNCAO[funcao]}>{ROTULO_FUNCAO[funcao]}</Selo>
                <Selo tom={TOM_ACESSO_CENTRAL[chaveAcesso]}>Central: {ROTULO_ACESSO_CENTRAL[chaveAcesso]}</Selo>
                {podeGerirCentral && !propria && (
                  <Select
                    aria-label={`Acesso à Central de ${nomeDe(u)}`}
                    value={chaveAcesso}
                    disabled={acessoSalvandoId === u.id}
                    onValueChange={(v) => onAlterarAcesso?.(u, v === "nenhum" ? null : (v as PapelCentral))}
                    opcoes={OPCOES_ACESSO_CENTRAL}
                  />
                )}
                {acessoSalvandoId === u.id && (
                  <span role="status" className="text-xs text-v2-nevoa/65">
                    Salvando…
                  </span>
                )}
                {propria ? (
                  <Selo tom="neutro">Você</Selo>
                ) : (
                  <>
                    <Button
                      variante="secundario"
                      onClick={() => onAlterarFuncao(u)}
                      aria-label={`Alterar função de ${nomeDe(u)}`}
                    >
                      Alterar função
                    </Button>
                    <Button
                      variante="secundario"
                      className="text-v2-queda"
                      onClick={() => onExcluir(u)}
                      aria-label={`Excluir ${nomeDe(u)}`}
                    >
                      Excluir
                    </Button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Surface>
  );
}
