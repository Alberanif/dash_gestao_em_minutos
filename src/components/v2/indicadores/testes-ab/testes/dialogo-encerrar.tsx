"use client";

import { useState } from "react";
import { Button, Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "../../../ui";
import type { TesteAb } from "./api-testes";

const SEM_DIFERENCA = "";

type Props = {
  teste: TesteAb | null;
  onFechar: () => void;
  /** vencedor = id da variante, ou "" para "sem diferença". */
  onEncerrar: (teste: TesteAb, vencedor: string, anotacao: string) => Promise<void>;
};

export function DialogoEncerrar({ teste, onFechar, onEncerrar }: Props) {
  return (
    <Dialog open={teste !== null} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent>{teste && <Formulario key={teste.id} teste={teste} onFechar={onFechar} onEncerrar={onEncerrar} />}</DialogContent>
    </Dialog>
  );
}

function Formulario({ teste, onFechar, onEncerrar }: { teste: TesteAb; onFechar: () => void; onEncerrar: Props["onEncerrar"] }) {
  const [vencedor, setVencedor] = useState<string>(SEM_DIFERENCA);
  const [anotacao, setAnotacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setSalvando(true);
    try {
      await onEncerrar(teste, vencedor, anotacao.trim());
      onFechar();
    } catch (err) {
      setErro(err instanceof Error && err.message ? err.message : "Não foi possível concluir a ação.");
    } finally {
      setSalvando(false);
    }
  }

  const opcoes = [
    ...(teste.ab_variantes ?? []).map((v) => ({
      valor: v.id,
      texto: `Variante ${v.rotulo}${v.central_links ? ` — ${v.central_links.label}` : ""}`,
    })),
    { valor: SEM_DIFERENCA, texto: "Sem diferença" },
  ];

  return (
    <form onSubmit={enviar}>
      <DialogTitle className="text-lg font-bold">Encerrar teste</DialogTitle>
      <DialogDescription className="mt-1 text-sm text-v2-nevoa/65">
        Quem venceu em &ldquo;{teste.nome}&rdquo;? Depois de encerrado, o teste deixa de contar visitas.
      </DialogDescription>
      <fieldset className="mt-4 flex flex-col gap-1">
        <legend className="mb-1 text-[13px] font-medium text-v2-nevoa/70">Vencedor</legend>
        {opcoes.map((o) => (
          <label key={o.valor || "sem"} className="flex min-h-11 items-center gap-3 text-sm text-v2-nevoa">
            <input
              type="radio"
              name="vencedor"
              checked={vencedor === o.valor}
              onChange={() => setVencedor(o.valor)}
              className="h-4 w-4 accent-v2-azul-igt"
            />
            {o.texto}
          </label>
        ))}
      </fieldset>
      <div className="mt-4 flex flex-col gap-1.5">
        <label htmlFor="anotacao-encerrar" className="text-[13px] font-medium text-v2-nevoa/70">
          Anotação (opcional)
        </label>
        <textarea
          id="anotacao-encerrar"
          value={anotacao}
          onChange={(e) => setAnotacao(e.target.value)}
          maxLength={2000}
          rows={4}
          className="w-full rounded-v2-sm bg-v2-casco-alto p-3 text-sm text-v2-nevoa shadow-v2-1 ring-1 ring-inset ring-v2-azul-luz/15"
        />
      </div>
      <p role="alert" className="mt-3 min-h-5 text-sm text-v2-queda">
        {erro}
      </p>
      <div className="mt-6 flex justify-end gap-3">
        <DialogClose asChild>
          <Button variante="secundario">Cancelar</Button>
        </DialogClose>
        <Button type="submit" disabled={salvando}>
          {salvando ? "Encerrando…" : "Encerrar teste"}
        </Button>
      </div>
    </form>
  );
}
