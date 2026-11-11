"use client";

import { useState } from "react";
import type { VendasFolderRecord } from "@/types/vendas";
import { Button, Campo, Dialog, DialogClose, DialogContent, DialogTitle, Input } from "../ui";
import { useRetornoDeFoco } from "./use-retorno-de-foco";

interface ModalDePastaProps {
  folderTarget?: VendasFolderRecord | null;
  // Rejeitar com Error mostra a mensagem no modal, que continua aberto.
  onSave: (name: string) => Promise<void>;
  onCancel: () => void;
}

/** Criar ou renomear uma pasta de visualizações. */
export function ModalDePasta({ folderTarget, onSave, onCancel }: ModalDePastaProps) {
  const [name, setName] = useState(folderTarget?.name ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const edicao = Boolean(folderTarget);
  const devolverFoco = useRetornoDeFoco();

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const aparado = name.trim();
    if (!aparado) {
      setErro("Nome da pasta é obrigatório");
      return;
    }
    setErro(null);
    setEnviando(true);
    try {
      await onSave(aparado);
    } catch (err) {
      setErro(err instanceof Error && err.message ? err.message : "Erro ao salvar pasta");
      setEnviando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && !enviando && onCancel()}>
      <DialogContent data-testid="folder-form-modal" aria-describedby={undefined} onCloseAutoFocus={devolverFoco}>
        <DialogTitle className="text-lg font-bold">{edicao ? "Renomear pasta" : "Nova pasta"}</DialogTitle>
        <form onSubmit={enviar} className="mt-4 flex flex-col gap-4">
          <Campo rotulo="Nome da pasta">
            {(p) => (
              <Input
                {...p}
                data-testid="folder-name-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Lançamentos 2026"
                disabled={enviando}
              />
            )}
          </Campo>

          {erro && (
            <p
              role="alert"
              data-testid="folder-form-error"
              className="rounded-v2-sm bg-v2-queda/10 px-3 py-2 text-sm text-v2-queda"
            >
              {erro}
            </p>
          )}

          <div className="flex justify-end gap-3">
            <DialogClose asChild>
              <Button variante="secundario" disabled={enviando}>
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" data-testid="folder-form-submit" disabled={enviando}>
              {enviando ? "Salvando…" : edicao ? "Salvar nome" : "Criar pasta"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
