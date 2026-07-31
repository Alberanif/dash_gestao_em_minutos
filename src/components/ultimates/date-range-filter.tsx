"use client";

import { useEffect, useState } from "react";
import { parseDateRange, type DateRange } from "@/lib/ultimates/date-range";

export interface DateRangeFilterProps {
  // Intervalo APLICADO. `null` = ciclo inteiro.
  value: DateRange | null;
  // `null` significa "Limpar".
  onChange: (range: DateRange | null) => void;
  // O recorte do roster não está disponível (migration 058 pendente — a rota
  // devolveu 501). A barra continua visível, dizendo por que não funciona:
  // esconder o controle deixaria quem procura o filtro achando que ele nunca
  // existiu, em vez de saber que falta subir banco.
  unavailable?: boolean;
}

// Barra De/Até do dashboard do ciclo (spec 2026-07-31). Ela só cuida do
// formulário — validar formato e ordem é de parseDateRange, e o que o intervalo
// SIGNIFICA é do dashboard.
//
// Componente controlado por `value` mas com rascunho local: quem está digitando
// "De" ainda não aplicou nada, e o dashboard não deve refazer a chamada do
// roster a cada tecla. O commit é no "Aplicar".
export function DateRangeFilter({ value, onChange, unavailable = false }: DateRangeFilterProps) {
  const [start, setStart] = useState(value?.start ?? "");
  const [end, setEnd] = useState(value?.end ?? "");
  const [erro, setErro] = useState("");

  // Sincroniza o rascunho quando o intervalo aplicado muda por fora — é o que
  // faz o intervalo restaurado do localStorage aparecer nos campos, já que o
  // dashboard só o lê depois do primeiro render (localStorage não existe no
  // servidor).
  useEffect(() => {
    setStart(value?.start ?? "");
    setEnd(value?.end ?? "");
    setErro("");
  }, [value]);

  function handleApply() {
    if (!start || !end) {
      setErro("Preencha as duas datas");
      return;
    }
    const range = parseDateRange(start, end);
    if (range === null) {
      // parseDateRange recusa formato inválido E ordem invertida. O <input
      // type="date"> já garante o formato, então a ordem é o único caso que
      // sobra para o usuário ver.
      setErro("A data final não pode ser anterior à inicial");
      return;
    }
    setErro("");
    onChange(range);
  }

  function handleClear() {
    setStart("");
    setEnd("");
    setErro("");
    onChange(null);
  }

  return (
    <div data-testid="ultimates-date-filter" className="ult-date-filter">
      <label className="ult-date-field">
        <span>De</span>
        <input
          data-testid="ultimates-date-start"
          type="date"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          disabled={unavailable}
        />
      </label>

      <label className="ult-date-field">
        <span>Até</span>
        <input
          data-testid="ultimates-date-end"
          type="date"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          disabled={unavailable}
        />
      </label>

      <button
        type="button"
        data-testid="ultimates-date-apply"
        className="btn-secondary"
        onClick={handleApply}
        disabled={unavailable}
      >
        Aplicar
      </button>

      {value !== null && (
        <button
          type="button"
          data-testid="ultimates-date-clear"
          className="btn-secondary"
          onClick={handleClear}
        >
          Limpar
        </button>
      )}

      {erro && (
        <span
          data-testid="ultimates-date-error"
          className="ult-date-msg"
          style={{ color: "var(--red)" }}
        >
          {erro}
        </span>
      )}

      {unavailable && (
        <span data-testid="ultimates-date-unavailable" className="ult-date-msg">
          Recorte por data indisponível — migration pendente
        </span>
      )}
    </div>
  );
}
