"use client";

import { useEffect, useRef, useState } from "react";
import {
  Button,
  Campo,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Select,
  Selo,
  Surface,
} from "../../ui";
import { executarAcaoDaConta } from "./lote";
import type { ContaPlataforma } from "./logs";

type Estado =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; campanhas: number }
  | { status: "error"; erro: string };

type Props = { contas: ContaPlataforma[] };

/** Cartão "Ajustes" do Meta Ads: abre o diálogo que sincroniza a lista de campanhas de uma conta. */
export function MetaAdsAjustes({ contas }: Props) {
  const [aberto, setAberto] = useState(false);
  const [conta, setConta] = useState("");
  const [estado, setEstado] = useState<Estado>({ status: "idle" });
  const montado = useRef(true);

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  function mudarAberto(v: boolean) {
    setAberto(v);
    // Ao reabrir, volta ao zero, como o modal do V1.
    if (v) setEstado({ status: "idle" });
  }

  const carregando = estado.status === "loading";

  async function sincronizar() {
    if (!conta) return;
    setEstado({ status: "loading" });
    const r = await executarAcaoDaConta("/api/meta-ads/campaigns-sync", conta);
    if (!montado.current) return;
    setEstado(
      r.ok
        ? { status: "success", campanhas: Number(r.json.campaignsCollected ?? 0) }
        : { status: "error", erro: r.erro },
    );
  }

  return (
    <Surface className="v2-entra flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" style={{ "--i": 2 } as React.CSSProperties}>
      <div>
        <h2 className="m-0 text-base font-semibold">Ajustes do Meta Ads</h2>
        <p className="mt-1 text-sm text-v2-nevoa/65">Sincroniza a lista completa de campanhas ativas de uma conta Meta.</p>
      </div>
      <Button variante="secundario" onClick={() => mudarAberto(true)} className="w-full shrink-0 sm:w-auto">
        Abrir ajustes
      </Button>

      <Dialog open={aberto} onOpenChange={mudarAberto}>
        <DialogContent>
          <DialogTitle className="m-0 text-lg font-semibold">Ajustes do Meta Ads</DialogTitle>
          <DialogDescription className="mt-2 text-sm text-v2-nevoa/65">
            Sincronize a lista completa de campanhas ativas da sua conta Meta.
          </DialogDescription>
          <div className="mt-5 flex flex-col gap-4">
            <Campo rotulo="Conta">
              {() => (
                <Select
                  aria-label="Conta do Meta Ads"
                  value={conta}
                  onValueChange={setConta}
                  opcoes={contas.map((c) => ({ value: c.id, label: c.name }))}
                  placeholder="Selecione uma conta"
                  disabled={carregando}
                />
              )}
            </Campo>
            <Button onClick={sincronizar} disabled={!conta || carregando} className="w-full">
              {carregando ? "Sincronizando..." : "Sincronizar campanhas"}
            </Button>
            {estado.status === "success" ? (
              <div role="status">
                <Selo tom="ok">{`${estado.campanhas} campanhas sincronizadas`}</Selo>
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
            <div className="flex justify-end">
              <DialogClose asChild>
                <Button variante="secundario">Fechar</Button>
              </DialogClose>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Surface>
  );
}
