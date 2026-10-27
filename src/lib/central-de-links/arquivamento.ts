// Regras puras do arquivamento automático (sem rede, sem banco, sem navegador).

export class FalhaDeArquivamento extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "FalhaDeArquivamento";
  }
}

/** Mesmo limite do bucket "paginas". */
export const LIMITE_BYTES = 50 * 1024 * 1024;
/** Abaixo dos 300 s da função. */
export const TEMPO_CAPTURA_MS = 240_000;
/** "arquivando" além disso é tentativa que morreu. */
export const TRAVA_OBSOLETA_MS = 6 * 60_000;
/** Captura menor que esta fração da cópia atual é recusada. */
export const ENCOLHEU_ABAIXO = 0.5;

export function validarCaptura(
  html: Buffer,
  { temCopia, tamanhoAtual }: { temCopia: boolean; tamanhoAtual: number | null },
): void {
  if (!html.length || !/<html/i.test(html.subarray(0, 4096).toString("utf8"))) {
    throw new FalhaDeArquivamento("A captura veio vazia ou inválida.");
  }
  if (html.length > LIMITE_BYTES) {
    throw new FalhaDeArquivamento("A cópia passa de 50 MB.");
  }
  if (temCopia && tamanhoAtual && html.length < tamanhoAtual * ENCOLHEU_ABAIXO) {
    throw new FalhaDeArquivamento(
      "A nova captura ficou muito menor que a cópia atual; a cópia anterior foi mantida.",
    );
  }
}

/** Com cópia anterior, ela segue valendo: o motivo vai em arquivo_erro. */
export function statusAposFalha(temCopia: boolean): "ok" | "falhou" {
  return temCopia ? "ok" : "falhou";
}

export function limitarMensagem(msg: string): string {
  return msg.slice(0, 300);
}

export function travaObsoleta(tentativaEm: string | null, agora: Date): boolean {
  if (!tentativaEm) return true;
  const t = new Date(tentativaEm).getTime();
  if (Number.isNaN(t)) return true;
  return agora.getTime() - t > TRAVA_OBSOLETA_MS;
}
