"use client";

import { useState } from "react";
import { TIPOS_DE_LINK, type LinkDaCentral } from "@/lib/central-de-links/tipos";
import { Button, Campo, Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, Input, Select } from "../../../ui";
import type { TesteAb, VarianteEnviada } from "./api-testes";

const MIN = 2;
const MAX = 8;
const ROTULOS = "ABCDEFGH";

type Linha = { chave: number; link_id: string; rotulo: string; controle: boolean };

export type DadosDoTeste = { id?: string; nome: string; variantes: VarianteEnviada[] };

type Props = {
  /** null = fechado; `{ teste: null }` = novo teste. */
  alvo: { teste: TesteAb | null } | null;
  /** Links `cap` não excluídos. */
  paginas: LinkDaCentral[];
  onFechar: () => void;
  onSalvar: (dados: DadosDoTeste) => Promise<void>;
};

export function DialogoDeTeste({ alvo, paginas, onFechar, onSalvar }: Props) {
  return (
    <Dialog open={alvo !== null} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent>
        {alvo && <Formulario key={alvo.teste?.id ?? "novo"} teste={alvo.teste} paginas={paginas} onFechar={onFechar} onSalvar={onSalvar} />}
      </DialogContent>
    </Dialog>
  );
}

function Formulario({ teste, paginas, onFechar, onSalvar }: Omit<Props, "alvo"> & { teste: TesteAb | null }) {
  const [nome, setNome] = useState(teste?.nome ?? "");
  const [proxima, setProxima] = useState(100);
  const [linhas, setLinhas] = useState<Linha[]>(() =>
    teste?.ab_variantes?.length
      ? teste.ab_variantes.map((v, i) => ({ chave: i, link_id: v.link_id, rotulo: v.rotulo, controle: v.controle }))
      : [
          { chave: 0, link_id: "", rotulo: "A", controle: true },
          { chave: 1, link_id: "", rotulo: "B", controle: false },
        ],
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  // Páginas já usadas pelo teste entram mesmo se saíram da lista (ex.: mudaram de tipo).
  const opcoes = [...paginas];
  for (const v of teste?.ab_variantes ?? []) {
    if (!opcoes.some((p) => p.id === v.link_id) && v.central_links) {
      opcoes.push({ id: v.link_id, label: v.central_links.label, url: v.central_links.url } as LinkDaCentral);
    }
  }

  function mudar(chave: number, parte: Partial<Linha>) {
    setLinhas((ls) => ls.map((l) => (l.chave === chave ? { ...l, ...parte } : l)));
  }
  function marcarControle(chave: number) {
    setLinhas((ls) => ls.map((l) => ({ ...l, controle: l.chave === chave })));
  }
  function adicionar() {
    setLinhas((ls) => {
      if (ls.length >= MAX) return ls;
      const usados = new Set(ls.map((l) => l.rotulo.toLowerCase()));
      const rotulo = [...ROTULOS].find((r) => !usados.has(r.toLowerCase())) ?? "";
      return [...ls, { chave: proxima, link_id: "", rotulo, controle: false }];
    });
    setProxima((n) => n + 1);
  }
  function remover(chave: number) {
    setLinhas((ls) => {
      if (ls.length <= MIN) return ls;
      const resto = ls.filter((l) => l.chave !== chave);
      // Se saiu o controle, o primeiro assume para a regra "exatamente um" continuar valendo.
      return resto.some((l) => l.controle) ? resto : resto.map((l, i) => ({ ...l, controle: i === 0 }));
    });
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setSalvando(true);
    try {
      await onSalvar({
        id: teste?.id,
        nome: nome.trim(),
        variantes: linhas.map((l) => ({ link_id: l.link_id, rotulo: l.rotulo.trim(), controle: l.controle })),
      });
      onFechar();
    } catch (err) {
      setErro(err instanceof Error && err.message ? err.message : "Não foi possível concluir a ação.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={enviar} noValidate>
      <DialogTitle className="text-lg font-bold">{teste ? "Editar teste" : "Novo teste"}</DialogTitle>
      <DialogDescription className="mt-1 text-sm text-v2-nevoa/65">
        Escolha de 2 a 8 páginas de captura para comparar e marque uma como controle.
      </DialogDescription>
      <div className="mt-4 flex max-h-[60vh] flex-col gap-4 overflow-y-auto pr-1">
        <Campo rotulo="Nome do teste">
          {(a) => <Input {...a} value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} autoComplete="off" />}
        </Campo>
        <div className="flex flex-col gap-3">
          <span className="text-[13px] font-medium text-v2-nevoa/70">Variantes</span>
          {linhas.map((l, i) => (
            <div key={l.chave} className="flex flex-col gap-2 rounded-v2-sm bg-v2-casco-alto/50 p-3 sm:flex-row sm:items-center" data-testid="variante">
              <div className="min-w-0 flex-1">
                <Select
                  aria-label={`Página da variante ${i + 1}`}
                  value={l.link_id || undefined}
                  onValueChange={(v) => mudar(l.chave, { link_id: v })}
                  placeholder="Escolha a página…"
                  opcoes={opcoes.map((p) => ({ value: p.id, label: p.label }))}
                />
              </div>
              <Input
                aria-label={`Rótulo da variante ${i + 1}`}
                className="sm:w-24"
                value={l.rotulo}
                maxLength={20}
                autoComplete="off"
                onChange={(e) => mudar(l.chave, { rotulo: e.target.value })}
              />
              <label className="flex min-h-11 items-center gap-2 whitespace-nowrap text-sm text-v2-nevoa">
                <input
                  type="radio"
                  name="controle"
                  checked={l.controle}
                  onChange={() => marcarControle(l.chave)}
                  aria-label={`Controle: variante ${i + 1}`}
                  className="h-4 w-4 accent-v2-azul-igt"
                />
                Controle
              </label>
              <Button
                variante="fantasma"
                className="text-v2-queda"
                disabled={linhas.length <= MIN}
                onClick={() => remover(l.chave)}
                aria-label={`Remover variante ${i + 1}`}
              >
                Remover
              </Button>
            </div>
          ))}
          <div>
            <Button variante="secundario" disabled={linhas.length >= MAX} onClick={adicionar}>
              Adicionar variante
            </Button>
          </div>
          {paginas.length === 0 && (
            <p className="text-xs text-v2-nevoa/60">Nenhuma página do tipo {TIPOS_DE_LINK.cap} cadastrada ainda.</p>
          )}
        </div>
      </div>
      <p role="alert" className="mt-3 min-h-5 text-sm text-v2-queda">
        {erro}
      </p>
      <div className="mt-6 flex items-center justify-end gap-3">
        <DialogClose asChild>
          <Button variante="secundario">Cancelar</Button>
        </DialogClose>
        <Button type="submit" disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </form>
  );
}
