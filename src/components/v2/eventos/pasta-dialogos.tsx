"use client";

import { useId, useState, useTransition, type CSSProperties, type FormEvent } from "react";
import { Button } from "../ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "../ui/dialog";
import { cx, foco } from "../ui/cx";
import {
  COR_PADRAO,
  NOME_PASTA_MAX,
  PALETA,
  erroDoNomePasta,
  hexDaCor,
  normalizarNomePasta,
  type CorPasta,
  type ResultadoAcao,
} from "./pastas-regras";

type PropsFormulario = {
  modo: "criar" | "editar";
  inicial: { nome: string; cor: CorPasta };
  /** Nomes das outras pastas, para barrar repetição antes de ir ao servidor. */
  nomesOutros: readonly string[];
  onSalvar: (nome: string, cor: CorPasta) => Promise<ResultadoAcao>;
  onFechar: () => void;
};

/** Nome e cor da pasta. Vive dentro do diálogo: cada abertura começa do zero. */
function Formulario({ modo, inicial, nomesOutros, onSalvar, onFechar }: PropsFormulario) {
  const idNome = useId();
  const idErro = useId();
  const [nome, setNome] = useState(inicial.nome);
  const [cor, setCor] = useState<CorPasta>(inicial.cor);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function enviar(e: FormEvent) {
    e.preventDefault();
    const problema = erroDoNomePasta(nome, nomesOutros);
    if (problema) return setErro(problema);
    setErro(null);
    iniciar(async () => {
      const r = await onSalvar(normalizarNomePasta(nome), cor);
      if (r.ok) onFechar();
      else setErro(r.erro);
    });
  }

  return (
    <form onSubmit={enviar} noValidate className="mt-5 space-y-5">
      <div>
        <label htmlFor={idNome} className="text-sm font-medium">
          Nome da pasta
        </label>
        <input
          id={idNome}
          value={nome}
          onChange={(e) => {
            setNome(e.target.value);
            setErro(null);
          }}
          maxLength={NOME_PASTA_MAX}
          autoComplete="off"
          autoFocus
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro ? idErro : undefined}
          placeholder="Ex.: Imersões 2026"
          className={cx(
            "mt-2 h-10 w-full rounded-v2-sm bg-v2-abismo px-3 text-sm text-v2-nevoa ring-1 ring-inset ring-v2-azul-luz/20 placeholder:text-v2-nevoa/40",
            foco,
          )}
        />
        <p className="mt-1.5 text-right text-xs text-v2-nevoa/50">
          {nome.length}/{NOME_PASTA_MAX}
        </p>
      </div>

      <fieldset>
        <legend className="text-sm font-medium">Cor</legend>
        <div className="mt-3 flex flex-wrap gap-3">
          {PALETA.map((c) => (
            <label key={c.chave} className="relative cursor-pointer">
              <input
                type="radio"
                name="cor-pasta"
                value={c.chave}
                checked={cor === c.chave}
                onChange={() => setCor(c.chave)}
                className="peer sr-only"
              />
              <span className="sr-only">{c.nome}</span>
              <span
                aria-hidden="true"
                style={{ background: hexDaCor(c.chave) } as CSSProperties}
                className="block size-9 rounded-full shadow-v2-1 ring-2 ring-transparent ring-offset-2 ring-offset-v2-casco transition-transform duration-[160ms] hover:scale-110 peer-checked:scale-110 peer-checked:ring-v2-nevoa peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-v2-azul-luz"
              />
            </label>
          ))}
        </div>
      </fieldset>

      <p id={idErro} role="alert" className="min-h-5 text-sm text-v2-queda">
        {erro}
      </p>

      <div className="flex justify-end gap-3">
        <DialogClose asChild>
          <Button variante="secundario">Cancelar</Button>
        </DialogClose>
        <Button type="submit" disabled={pendente}>
          {pendente ? "Salvando…" : modo === "criar" ? "Criar pasta" : "Salvar"}
        </Button>
      </div>
    </form>
  );
}

type PropsPastaDialogo = {
  aberto: boolean;
  onAbertoChange: (aberto: boolean) => void;
  modo: "criar" | "editar";
  inicial?: { nome: string; cor: CorPasta };
  nomesOutros: readonly string[];
  onSalvar: (nome: string, cor: CorPasta) => Promise<ResultadoAcao>;
  /** Texto de apoio do diálogo; padrão: o das pastas de eventos. */
  descricao?: string;
};

export function PastaDialogo({ aberto, onAbertoChange, modo, inicial, nomesOutros, onSalvar, descricao }: PropsPastaDialogo) {
  return (
    <Dialog open={aberto} onOpenChange={onAbertoChange}>
      <DialogContent>
        <DialogTitle className="text-xl font-semibold">{modo === "criar" ? "Nova pasta" : "Editar pasta"}</DialogTitle>
        <DialogDescription className="mt-1 text-sm text-v2-nevoa/60">
          {descricao ?? (modo === "criar" ? "Dê um nome e escolha a cor. Depois é só colocar eventos nela." : "Mude o nome ou a cor da pasta.")}
        </DialogDescription>
        <Formulario
          modo={modo}
          inicial={inicial ?? { nome: "", cor: COR_PADRAO }}
          nomesOutros={nomesOutros}
          onSalvar={onSalvar}
          onFechar={() => onAbertoChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

type PropsExclusao = {
  aberto: boolean;
  onAbertoChange: (aberto: boolean) => void;
  nome: string;
  total: number;
  onExcluir: () => Promise<ResultadoAcao>;
};

export function ExclusaoDialogo({ aberto, onAbertoChange, nome, total, onExcluir }: PropsExclusao) {
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function confirmar() {
    setErro(null);
    iniciar(async () => {
      const r = await onExcluir();
      if (r.ok) onAbertoChange(false);
      else setErro(r.erro);
    });
  }

  return (
    <Dialog
      open={aberto}
      onOpenChange={(v) => {
        if (!v) setErro(null);
        onAbertoChange(v);
      }}
    >
      <DialogContent>
        <DialogTitle className="text-xl font-semibold">Excluir a pasta “{nome}”?</DialogTitle>
        <DialogDescription className="mt-2 text-sm text-v2-nevoa/70">
          {total > 0
            ? `Os ${total} ${total === 1 ? "evento volta" : "eventos voltam"} para a lista sem pasta. Só o agrupamento é desfeito.`
            : "A pasta está vazia. Nenhum evento é afetado."}
        </DialogDescription>
        <p role="alert" className="mt-3 min-h-5 text-sm text-v2-queda">
          {erro}
        </p>
        <div className="mt-2 flex justify-end gap-3">
          <DialogClose asChild>
            <Button variante="secundario">Cancelar</Button>
          </DialogClose>
          <Button variante="secundario" className="text-v2-queda" onClick={confirmar} disabled={pendente}>
            {pendente ? "Excluindo…" : "Excluir pasta"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
