"use client";

import { useState } from "react";
import type { Account } from "@/types/accounts";
import { Button, Confirmar, Surface, Selo } from "../../ui";
import { cx, foco } from "../../ui/cx";
import { FormularioConta } from "./formulario-conta";
import { PLATAFORMAS, type Plataforma } from "./plataformas";

type Formulario = { conta?: Account; plataforma: Plataforma } | null;

export function ContasConectadas({ contasIniciais }: { contasIniciais: Account[] }) {
  const [contas, setContas] = useState<Account[]>(contasIniciais);
  const [formulario, setFormulario] = useState<Formulario>(null);
  const [aExcluir, setAExcluir] = useState<Account | null>(null);

  async function recarregar() {
    const res = await fetch("/api/accounts");
    const data = await res.json();
    setContas(data);
  }

  async function alternarAtiva(conta: Account) {
    await fetch(`/api/accounts/${conta.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !conta.is_active }),
    });
    await recarregar();
  }

  async function excluir(conta: Account) {
    setAExcluir(null);
    await fetch(`/api/accounts/${conta.id}`, { method: "DELETE" });
    await recarregar();
  }

  function aoSalvar() {
    setFormulario(null);
    recarregar();
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="v2-entra flex justify-end" style={{ "--i": 1 } as React.CSSProperties}>
        <Button onClick={() => setFormulario({ plataforma: "youtube" })}>Nova conta</Button>
      </div>

      {PLATAFORMAS.map(({ chave, rotulo }, i) => {
        const daPlataforma = contas.filter((c) => c.platform === chave);
        return (
          <Surface
            key={chave}
            nivel={1}
            className="v2-entra flex flex-col gap-4"
            style={{ "--i": i + 2 } as React.CSSProperties}
            role="group"
            aria-label={rotulo}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="m-0 text-base font-semibold">{rotulo}</h2>
              <span className="text-xs text-v2-nevoa/55">
                {daPlataforma.length === 1 ? "1 conta" : `${daPlataforma.length} contas`}
              </span>
            </div>

            {daPlataforma.length === 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-v2-sm bg-v2-abismo/40 px-4 py-4">
                <p className="m-0 text-sm text-v2-nevoa/65">Nenhuma conta de {rotulo} conectada.</p>
                <Button variante="secundario" onClick={() => setFormulario({ plataforma: chave })}>
                  Adicionar conta de {rotulo}
                </Button>
              </div>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {daPlataforma.map((conta) => (
                  <li
                    key={conta.id}
                    className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-v2-sm bg-v2-abismo/40 px-4 py-3"
                  >
                    <div className="flex min-w-0 flex-1 basis-48 flex-col items-start gap-1.5">
                      <p className="m-0 max-w-full break-words text-sm font-medium">{conta.name}</p>
                      <Selo tom={conta.is_active ? "ok" : "neutro"}>
                        <span
                          aria-hidden="true"
                          className={cx(
                            "size-1.5 rounded-full",
                            conta.is_active ? "bg-v2-alta" : "bg-v2-nevoa/40",
                          )}
                        />
                        {conta.is_active ? "Ativa" : "Inativa"}
                      </Selo>
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      <BotaoTexto
                        onClick={() => alternarAtiva(conta)}
                        aria-label={`${conta.is_active ? "Desativar" : "Ativar"} ${conta.name}`}
                      >
                        {conta.is_active ? "Desativar" : "Ativar"}
                      </BotaoTexto>
                      <BotaoTexto
                        onClick={() => setFormulario({ conta, plataforma: conta.platform })}
                        aria-label={`Editar ${conta.name}`}
                      >
                        Editar
                      </BotaoTexto>
                      <BotaoTexto
                        perigo
                        onClick={() => setAExcluir(conta)}
                        aria-label={`Excluir ${conta.name}`}
                      >
                        Excluir
                      </BotaoTexto>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Surface>
        );
      })}

      {formulario && (
        <FormularioConta
          conta={formulario.conta}
          plataformaInicial={formulario.plataforma}
          onSalvar={aoSalvar}
          onCancelar={() => setFormulario(null)}
        />
      )}

      <Confirmar
        aberto={!!aExcluir}
        onFechar={() => setAExcluir(null)}
        onConfirmar={() => aExcluir && excluir(aExcluir)}
        titulo={aExcluir ? `Excluir a conta "${aExcluir.name}"?` : "Excluir conta"}
        descricao="Todos os dados coletados desta conta serão apagados permanentemente."
        rotuloConfirmar="Excluir"
      />
    </div>
  );
}

function BotaoTexto({
  perigo,
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { perigo?: boolean }) {
  return (
    <button
      type="button"
      className={cx(
        "h-9 rounded-v2-sm px-3 text-sm font-medium transition-opacity hover:opacity-80 active:opacity-60",
        perigo ? "text-v2-queda" : "text-v2-azul-luz",
        foco,
        className,
      )}
      {...rest}
    />
  );
}
