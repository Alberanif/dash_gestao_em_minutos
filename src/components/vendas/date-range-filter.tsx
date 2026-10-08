"use client";

import { useState } from "react";
import { parseDateRange, type DateRange } from "@/lib/vendas/date-range";
import { fmtDateFull } from "@/lib/vendas/format";

export interface DateRangeFilterProps {
  // Janela SALVA na visualização. `null` = sem recorte (todo o período).
  value: DateRange | null;
  // Só gestor define a janela (migration 063). Para os demais esta barra é
  // informativa: eles precisam saber que os números passaram por um recorte,
  // mas não escolhem qual.
  canEdit: boolean;
  // Persiste na visualização e devolve se deu certo. Async de propósito: diferente do
  // filtro local que isto substituiu, aqui aplicar é gravar, e a barra tem de
  // mostrar que está gravando e que falhou.
  onSave: (range: DateRange | null) => Promise<boolean>;
  // A janela da visualização existe mas NÃO pôde ser aplicada (a busca dos
  // números recortados falhou). É "os números abaixo não são os que a janela
  // define", e por isso aparece em vermelho.
  unavailable?: boolean;
}

// Janela de período da visualização. A barra EDITA uma propriedade da
// visualização, e todo mundo que a abre vê o mesmo recorte.
//
// O componente só cuida do formulário — validar formato e ordem é de
// parseDateRange, persistir é de quem passa `onSave`, e o que a janela SIGNIFICA
// para KPIs e gráficos é do dashboard.
export function DateRangeFilter({
  value,
  canEdit,
  onSave,
  unavailable = false,
}: DateRangeFilterProps) {
  // Rascunho local: quem está digitando "De" ainda não salvou nada, e o
  // dashboard não deve refazer a busca dos números a cada tecla. O commit é no
  // "Salvar".
  const [start, setStart] = useState(value?.start ?? "");
  const [end, setEnd] = useState(value?.end ?? "");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(value);

  // Sincroniza o rascunho quando a janela salva muda POR FORA — troca de
  // visualização (o dashboard é renderizado sem key, então este componente não
  // remonta) e chegada do GET das visualizações depois do primeiro render.
  //
  // Ajuste durante o render, e não em useEffect: é o padrão que o React
  // recomenda para estado derivado de prop. O efeito faria o componente
  // renderizar uma vez com os campos da visualização anterior antes de corrigi-los, e
  // cairia na regra react-hooks/set-state-in-effect. Aqui o React descarta o
  // render em curso e refaz com os valores novos, sem pintar o intermediário.
  if (value !== salvo) {
    setSalvo(value);
    setStart(value?.start ?? "");
    setEnd(value?.end ?? "");
    setErro("");
  }

  // Aviso de degradação. Mora numa função porque as DUAS variantes da barra
  // (editor e leitura) precisam dele: quem não pode editar é justamente quem
  // não tem outra forma de descobrir que o recorte não pegou.
  const avisoIndisponivel = unavailable ? (
    <span
      data-testid="vendas-date-unavailable"
      className="vendas-date-msg"
      style={{ color: "var(--red)" }}
    >
      Período não pôde ser aplicado — os números abaixo são do período inteiro
    </span>
  ) : null;

  if (!canEdit) {
    // Sem janela definida, quem não edita não vê barra nenhuma: a visualização mostra
    // tudo, que é o estado normal, e dois campos de data vazios e desabilitados
    // só ocupariam espaço convidando ao clique.
    if (value === null) return null;

    return (
      <div data-testid="vendas-date-filter" className="vendas-date-filter">
        <span data-testid="vendas-date-readonly" className="vendas-date-readonly">
          Período: {fmtDateFull(value.start)} – {fmtDateFull(value.end)}
        </span>
        <span className="vendas-date-msg">definido pelo gestor</span>
        {avisoIndisponivel}
      </div>
    );
  }

  async function persistir(range: DateRange | null) {
    setSalvando(true);
    const ok = await onSave(range);
    setSalvando(false);
    // Rascunho PRESERVADO na falha, de propósito: quem escolheu duas datas e
    // esbarrou na rede não deve ter de escolhê-las de novo. Quem consome
    // `value` não mudou nada, então o dashboard segue mostrando a janela antiga
    // — e a mensagem abaixo diz que é isso mesmo.
    setErro(ok ? "" : "Não foi possível salvar o período. Tente novamente.");
  }

  function handleSave() {
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
    void persistir(range);
  }

  function handleClear() {
    setStart("");
    setEnd("");
    setErro("");
    void persistir(null);
  }

  return (
    <div data-testid="vendas-date-filter" className="vendas-date-filter">
      <label className="vendas-date-field">
        <span>De</span>
        <input
          data-testid="vendas-date-start"
          type="date"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          disabled={salvando}
        />
      </label>

      <label className="vendas-date-field">
        <span>Até</span>
        <input
          data-testid="vendas-date-end"
          type="date"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          disabled={salvando}
        />
      </label>

      <button
        type="button"
        data-testid="vendas-date-apply"
        className="btn-secondary"
        onClick={handleSave}
        disabled={salvando}
      >
        {salvando ? "Salvando..." : "Salvar"}
      </button>

      {value !== null && (
        <button
          type="button"
          data-testid="vendas-date-clear"
          className="btn-secondary"
          onClick={handleClear}
          disabled={salvando}
        >
          Limpar
        </button>
      )}

      {/* Presente SEMPRE que o gestor edita, com ou sem janela salva: é a única
          coisa na barra que diz que este controle não é um filtro pessoal. */}
      <span data-testid="vendas-date-scope" className="vendas-date-msg">
        Vale para todos os usuários
      </span>

      {erro && (
        <span
          data-testid="vendas-date-error"
          className="vendas-date-msg"
          style={{ color: "var(--red)" }}
        >
          {erro}
        </span>
      )}

      {avisoIndisponivel}
    </div>
  );
}
