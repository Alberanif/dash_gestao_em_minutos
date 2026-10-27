"use client";

import { Button, Selo, Surface } from "../../ui";
import { formatarData, type Usuario } from "./tipos";

/** Painel em destaque no topo: quem pediu acesso e aguarda decisão. Some quando não há ninguém. */
export function SolicitacoesPendentes({
  pendentes,
  onAprovar,
  onRejeitar,
}: {
  pendentes: Usuario[];
  onAprovar: (u: Usuario) => void;
  onRejeitar: (u: Usuario) => void;
}) {
  if (pendentes.length === 0) return null;
  return (
    <Surface
      nivel={2}
      className="v2-entra ring-v2-ponto/40"
      style={{ "--i": 1 } as React.CSSProperties}
      aria-labelledby="usuarios-pendentes-titulo"
      role="region"
    >
      <div className="flex items-center gap-3">
        <h2 id="usuarios-pendentes-titulo" className="m-0 text-base font-semibold">
          Solicitações pendentes
        </h2>
        <Selo tom="aviso">{pendentes.length}</Selo>
      </div>
      <p className="mt-1 text-sm text-v2-nevoa/65">Estas pessoas criaram conta e aguardam a sua decisão para entrar.</p>
      <ul className="mt-4 flex flex-col gap-3" aria-label="Solicitações pendentes">
        {pendentes.map((u) => (
          <li
            key={u.id}
            className="flex flex-col gap-3 rounded-v2-sm bg-v2-casco p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              {u.name && <p className="m-0 truncate text-sm font-medium">{u.name}</p>}
              <p className="m-0 break-all text-sm text-v2-nevoa/70">{u.email}</p>
              <p className="m-0 mt-0.5 text-xs text-v2-nevoa/55">Solicitado em {formatarData(u.created_at)}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button onClick={() => onAprovar(u)} aria-label={`Aprovar ${u.name || u.email}`}>
                Aprovar
              </Button>
              <Button
                variante="secundario"
                className="text-v2-queda"
                onClick={() => onRejeitar(u)}
                aria-label={`Rejeitar ${u.name || u.email}`}
              >
                Rejeitar
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Surface>
  );
}
