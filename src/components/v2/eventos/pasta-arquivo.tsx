import type { CSSProperties } from "react";
import { cx, foco } from "../ui/cx";
import type { PastaConfig } from "./pastas";

type Props = {
  pasta: PastaConfig;
  total: number;
  selecionada: boolean;
  /** Id do painel de eventos, só existe enquanto a pasta está selecionada. */
  idPainel: string;
  onSelecionar: () => void;
  /** Texto sob o nome; padrão "N eventos". A Central de links diz "N links". */
  rotulo?: string;
  /** Pasta de lista (Central de links): menor e sempre à vista, sem recuar quando outra abre. */
  lista?: boolean;
};

/** Quantas folhas aparecem dentro da pasta: uma por dashboard, no máximo três. */
export function folhasVisiveis(total: number): number {
  return Math.min(Math.max(total, 0), 3);
}

export function rotuloContagem(total: number): string {
  return total === 1 ? "1 evento" : `${total} eventos`;
}

/**
 * Pasta de arquivo (base: Cobp, Uiverse.io). Hover e foco abrem a pasta de espiada; selecionada,
 * ela fica aberta. As folhas lá dentro são os dashboards do grupo. A cor vem de `--pc`.
 */
export function PastaArquivo({ pasta, total, selecionada, idPainel, onSelecionar, rotulo, lista }: Props) {
  const folhas = folhasVisiveis(total);
  return (
    <button
      type="button"
      aria-expanded={selecionada}
      aria-controls={selecionada ? idPainel : undefined}
      data-aberta={selecionada ? "" : undefined}
      data-esmaecida={total === 0 ? "" : undefined}
      data-lista={lista ? "" : undefined}
      style={{ "--pc": pasta.hex } as CSSProperties}
      onClick={onSelecionar}
      className={cx("v2-pasta", foco)}
    >
      <span className="v2-pasta-corpo" aria-hidden="true">
        <span className="v2-pasta-fundo" />
        {[3, 2, 1].map((p) => p <= folhas && <span key={p} className="v2-pasta-folha" data-p={p} />)}
        <span className="v2-pasta-frente">
          <span className="v2-pasta-luz" />
        </span>
      </span>
      <span className="v2-pasta-nome">
        <span aria-hidden="true" className={cx("size-2.5 shrink-0 rounded-full", pasta.marcador)} />
        <span className="v2-pasta-titulo">{pasta.nome}</span>
      </span>
      <span className="v2-pasta-conta">{rotulo ?? rotuloContagem(total)}</span>
    </button>
  );
}

/** A casa tracejada no fim da fileira: abre o diálogo de nova pasta. */
export function PastaNova({ onAbrir, desabilitada, motivo }: { onAbrir: () => void; desabilitada?: boolean; motivo?: string }) {
  return (
    <button type="button" onClick={onAbrir} disabled={desabilitada} aria-haspopup="dialog" className={cx("v2-pasta-nova", foco)}>
      <span className="v2-pasta-nova-corpo" aria-hidden="true">
        <svg viewBox="0 0 24 24" className="v2-pasta-nova-mais" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </span>
      <span className="v2-pasta-nome">Nova pasta</span>
      <span className="v2-pasta-conta">{desabilitada && motivo ? motivo : "Organize do seu jeito"}</span>
    </button>
  );
}
