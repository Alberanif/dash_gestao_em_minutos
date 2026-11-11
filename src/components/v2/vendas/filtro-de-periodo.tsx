"use client";

import { useState } from "react";
import { parseDateRange, type DateRange } from "@/lib/vendas/date-range";
import { fmtDateFull } from "@/lib/vendas/format";
import { Button, Campo, Input } from "../ui";

export interface FiltroDePeriodoProps {
  // Janela SALVA na visualização. `null` = sem recorte (todo o período).
  value: DateRange | null;
  // Quem edita define a janela (migration 063). Os demais só a veem: precisam saber
  // que os números passaram por um recorte, mas não escolhem qual.
  canEdit: boolean;
  // Persiste na visualização e devolve se deu certo. Aplicar é gravar: a barra
  // mostra que está gravando e que falhou.
  onSave: (range: DateRange | null) => Promise<boolean>;
  // A janela existe mas NÃO pôde ser aplicada (a busca dos números recortados falhou).
  unavailable?: boolean;
}

// Janela de período da visualização. Edita uma propriedade da visualização: todo
// mundo que a abre vê o mesmo recorte. Validar formato e ordem é de parseDateRange;
// persistir é de quem passa `onSave`.
export function FiltroDePeriodo({ value, canEdit, onSave, unavailable = false }: FiltroDePeriodoProps) {
  // Rascunho local: quem digita "De" ainda não salvou nada, e o dashboard não
  // refaz a busca a cada tecla. O commit é no "Salvar".
  const [start, setStart] = useState(value?.start ?? "");
  const [end, setEnd] = useState(value?.end ?? "");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(value);

  // Sincroniza o rascunho quando a janela salva muda por fora (troca de visualização,
  // chegada do GET depois do primeiro render). Ajuste durante o render, como o React
  // recomenda para estado derivado de prop.
  if (value !== salvo) {
    setSalvo(value);
    setStart(value?.start ?? "");
    setEnd(value?.end ?? "");
    setErro("");
  }

  // Presente nas duas variantes (editor e leitura): quem não edita é quem não tem
  // outra forma de descobrir que o recorte não pegou.
  const avisoIndisponivel = unavailable ? (
    <span data-testid="vendas-date-unavailable" className="text-xs text-v2-queda">
      Período não pôde ser aplicado. Os números abaixo são do período inteiro.
    </span>
  ) : null;

  if (!canEdit) {
    // Sem janela, quem não edita não vê barra: mostrar tudo é o estado normal.
    if (value === null) return null;
    return (
      <div data-testid="vendas-date-filter" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span data-testid="vendas-date-readonly" className="text-v2-nevoa">
          Período: {fmtDateFull(value.start)} – {fmtDateFull(value.end)}
        </span>
        <span className="text-xs text-v2-nevoa/65">definido pelo gestor</span>
        {avisoIndisponivel}
      </div>
    );
  }

  async function persistir(range: DateRange | null) {
    setSalvando(true);
    const ok = await onSave(range);
    setSalvando(false);
    // Rascunho preservado na falha, de propósito: quem escolheu as datas e esbarrou
    // na rede não deve escolhê-las de novo.
    setErro(ok ? "" : "Não foi possível salvar o período. Tente novamente.");
  }

  function aoSalvar() {
    if (!start || !end) {
      setErro("Preencha as duas datas");
      return;
    }
    const range = parseDateRange(start, end);
    if (range === null) {
      setErro("A data final não pode ser anterior à inicial");
      return;
    }
    setErro("");
    void persistir(range);
  }

  function aoLimpar() {
    setStart("");
    setEnd("");
    setErro("");
    void persistir(null);
  }

  return (
    <div data-testid="vendas-date-filter" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-3">
        <Campo rotulo="De" className="w-40">
          {(p) => (
            <Input
              {...p}
              data-testid="vendas-date-start"
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              disabled={salvando}
            />
          )}
        </Campo>
        <Campo rotulo="Até" className="w-40">
          {(p) => (
            <Input
              {...p}
              data-testid="vendas-date-end"
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              disabled={salvando}
            />
          )}
        </Campo>
        <Button variante="secundario" data-testid="vendas-date-apply" onClick={aoSalvar} disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar período"}
        </Button>
        {value !== null && (
          <Button variante="fantasma" data-testid="vendas-date-clear" onClick={aoLimpar} disabled={salvando}>
            Limpar
          </Button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {/* Sempre presente para quem edita: diz que este controle não é um filtro pessoal. */}
        <span data-testid="vendas-date-scope" className="text-xs text-v2-nevoa/65">
          Vale para todos os usuários
        </span>
        {erro && (
          <span data-testid="vendas-date-error" role="alert" className="text-xs text-v2-queda">
            {erro}
          </span>
        )}
        {avisoIndisponivel}
      </div>
    </div>
  );
}
