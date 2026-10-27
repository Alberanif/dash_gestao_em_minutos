"use client";

import { Button } from "./button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "./dialog";

type ConfirmarProps = {
  aberto: boolean;
  onFechar: () => void;
  onConfirmar: () => void;
  titulo: string;
  descricao?: string;
  /** Verbo da ação, igual ao do botão que abriu o diálogo ("Excluir", não "Sim"). */
  rotuloConfirmar: string;
  carregando?: boolean;
};

/** Substitui window.confirm: diz o que será afetado e deixa a ação destrutiva explícita. */
export function Confirmar({ aberto, onFechar, onConfirmar, titulo, descricao, rotuloConfirmar, carregando }: ConfirmarProps) {
  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent>
        <DialogTitle className="text-lg font-bold">{titulo}</DialogTitle>
        {descricao && <DialogDescription className="mt-2 text-sm text-v2-nevoa/70">{descricao}</DialogDescription>}
        <div className="mt-6 flex justify-end gap-3">
          <DialogClose asChild>
            <Button variante="secundario">Cancelar</Button>
          </DialogClose>
          <Button
            onClick={onConfirmar}
            disabled={carregando}
            className="bg-v2-queda text-v2-abismo"
          >
            {carregando ? "Aguarde…" : rotuloConfirmar}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
