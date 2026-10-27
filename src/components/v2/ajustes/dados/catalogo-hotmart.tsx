"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Campo, Select, Selo, Surface } from "../../ui";
import { executarAcaoDaConta } from "./lote";
import type { ContaPlataforma } from "./logs";

type Estado =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; produtos: number; ofertas: number }
  | { status: "error"; erro: string };

type Props = {
  contas: ContaPlataforma[];
  contasCarregando: boolean;
  aoConcluir: () => void | Promise<void>;
  aoOcupar?: (ocupado: boolean) => void;
};

/** Sincroniza produtos e ofertas direto da API Hotmart, inclusive produtos sem vendas. */
export function CatalogoHotmart({ contas, contasCarregando, aoConcluir, aoOcupar }: Props) {
  const [contaEscolhida, setContaEscolhida] = useState("");
  const [estado, setEstado] = useState<Estado>({ status: "idle" });
  const montado = useRef(true);

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  const carregando = estado.status === "loading";
  useEffect(() => {
    aoOcupar?.(carregando);
    return () => aoOcupar?.(false);
  }, [carregando, aoOcupar]);

  const contaId = contas.some((c) => c.id === contaEscolhida) ? contaEscolhida : (contas[0]?.id ?? "");

  async function sincronizar() {
    setEstado({ status: "loading" });
    const r = await executarAcaoDaConta("/api/hotmart/sync-products", contaId);
    if (!montado.current) return;
    if (!r.ok) {
      setEstado({ status: "error", erro: r.erro });
      return;
    }
    setEstado({
      status: "success",
      produtos: Number(r.json.productsRecords ?? 0),
      ofertas: Number(r.json.offersRecords ?? 0),
    });
    await aoConcluir();
  }

  return (
    <Surface className="v2-entra flex flex-col gap-4" style={{ "--i": 2 } as React.CSSProperties}>
      <div>
        <h2 className="m-0 text-base font-semibold">Catálogo de produtos e ofertas</h2>
        <p className="mt-1 text-sm text-v2-nevoa/65">
          Atualiza produtos e ofertas direto da API da Hotmart, incluindo os produtos sem vendas.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <Campo
          rotulo="Conta"
          ajuda={!contasCarregando && contas.length === 0 ? "Nenhuma conta conectada nesta plataforma." : undefined}
        >
          {() => (
            <Select
              aria-label="Conta do catálogo"
              value={contaId}
              onValueChange={setContaEscolhida}
              opcoes={contas.map((c) => ({ value: c.id, label: c.name }))}
              placeholder={contasCarregando ? "Carregando contas" : "Sem contas"}
              disabled={contas.length === 0 || carregando}
            />
          )}
        </Campo>
        <Button onClick={sincronizar} disabled={!contaId || carregando} className="w-full sm:w-auto">
          {carregando ? "Sincronizando..." : "Sincronizar produtos"}
        </Button>
      </div>
      {estado.status === "success" ? (
        <div role="status">
          <Selo tom="ok">{`${estado.produtos} produtos e ${estado.ofertas} ofertas sincronizados`}</Selo>
        </div>
      ) : null}
      {estado.status === "error" ? (
        <div role="alert" className="flex flex-col gap-1">
          <Selo tom="erro" className="h-auto min-h-6 w-fit max-w-full whitespace-normal py-1">
            {estado.erro}
          </Selo>
          <p className="m-0 text-xs text-v2-nevoa/55">Confira a conta e sincronize de novo.</p>
        </div>
      ) : null}
    </Surface>
  );
}
