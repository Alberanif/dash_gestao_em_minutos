"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "../ui/dialog";

type Props = {
  eventoId: string;
  nome: string;
  onFechar: () => void;
};

/** Confirmação de exclusão do evento. Apaga o dashboard de vez: as pastas só deixam de listá-lo. */
export function ExcluirEvento({ eventoId, nome, onFechar }: Props) {
  const router = useRouter();
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function confirmar() {
    setExcluindo(true);
    setErro(null);
    try {
      const res = await fetch(`/api/indicadores/filters/${eventoId}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setErro((d as { error?: string }).error ?? "Não foi possível excluir o evento.");
        setExcluindo(false);
        return;
      }
      router.refresh();
      onFechar();
    } catch {
      setErro("Não foi possível excluir o evento.");
      setExcluindo(false);
    }
  }

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && !excluindo && onFechar()}>
      <DialogContent>
        <DialogTitle className="text-xl font-semibold">Excluir o evento “{nome}”?</DialogTitle>
        <DialogDescription className="mt-2 text-sm text-v2-nevoa/70">
          O dashboard deste evento e a configuração dele são apagados. Isso não pode ser desfeito.
        </DialogDescription>
        <p role="alert" className="mt-3 min-h-5 text-sm text-v2-queda">
          {erro}
        </p>
        <div className="mt-2 flex justify-end gap-3">
          <DialogClose asChild>
            <Button variante="secundario" disabled={excluindo}>
              Cancelar
            </Button>
          </DialogClose>
          <Button variante="secundario" className="text-v2-queda" onClick={confirmar} disabled={excluindo}>
            {excluindo ? "Excluindo…" : "Excluir evento"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
