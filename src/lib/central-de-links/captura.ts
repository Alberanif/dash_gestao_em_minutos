import { spawn } from "child_process";
import { createRequire } from "module";
import path from "path";
import { pathToFileURL } from "url";
import { FalhaDeArquivamento, TEMPO_CAPTURA_MS } from "./arquivamento";

export interface Navegador {
  exe: string;
  args: string[];
}

const SEM_NAVEGADOR =
  "O navegador de captura não está disponível neste ambiente. Só o arquivamento fica indisponível; o restante do sistema segue normal.";

/**
 * Chrome local (CHROME_PATH, para desenvolvimento) ou o Chromium empacotado (@sparticuz/chromium,
 * para a Vercel). Qualquer problema para achá-lo ou extraí-lo vira FalhaDeArquivamento.
 */
export async function localizarNavegador(): Promise<Navegador> {
  if (process.env.CHROME_PATH) return { exe: process.env.CHROME_PATH, args: [] };
  try {
    const { default: chromium } = await import("@sparticuz/chromium");
    return {
      exe: await chromium.executablePath(),
      args: chromium.args.filter((a: string) => !a.startsWith("--headless")),
    };
  } catch (e) {
    const motivo = e instanceof Error ? ` (${e.message})` : "";
    throw new FalhaDeArquivamento(`${SEM_NAVEGADOR}${motivo}`.slice(0, 300));
  }
}

function caminhoDoSingleFile(): string {
  // createRequire a partir da raiz do projeto: funciona no Next/Turbopack (pacote externo) e no Jest.
  const req = createRequire(path.join(process.cwd(), "package.json"));
  return path.join(path.dirname(req.resolve("single-file-cli/package.json")), "single-file-node.js");
}

/** Salva em `destino` uma cópia fiel (HTML único, estilo SingleFile) da página. */
export function capturar(url: string, destino: string, navegador: Navegador): Promise<void> {
  const args = [
    caminhoDoSingleFile(),
    url,
    destino,
    "--browser-executable-path=" + navegador.exe,
    "--filename-conflict-action=overwrite",
    "--browser-load-max-time=60000",
    "--browser-capture-max-time=90000",
  ];
  if (navegador.args.length) args.push("--browser-args=" + JSON.stringify(navegador.args));

  return new Promise<void>((ok, falha) => {
    const filho = spawn(process.execPath, args, { stdio: ["ignore", "ignore", "pipe"] });
    let erro = "";
    filho.stderr?.on("data", (d: Buffer | string) => {
      erro = (erro + d).slice(-600);
    });
    const relogio = setTimeout(() => {
      filho.kill("SIGKILL");
      falha(new FalhaDeArquivamento("A captura passou do tempo limite."));
    }, TEMPO_CAPTURA_MS);
    filho.on("error", () => {
      clearTimeout(relogio);
      falha(new FalhaDeArquivamento(SEM_NAVEGADOR));
    });
    filho.on("close", (codigo: number | null) => {
      clearTimeout(relogio);
      if (codigo === 0) ok();
      else
        falha(
          new FalhaDeArquivamento(
            "O navegador não conseguiu capturar a página. " + (erro.trim().split("\n").pop() ?? ""),
          ),
        );
    });
  });
}

const TEMPO_MINIATURA_MS = 60_000;

/**
 * Tira uma imagem (PNG, 1280x800) da cópia já salva em `arquivoHtml`, abrindo o arquivo local no navegador.
 * Não toca na rede: é a cópia arquivada que vira a miniatura. Falha vira FalhaDeArquivamento.
 */
export function capturarMiniatura(arquivoHtml: string, destinoPng: string, navegador: Navegador): Promise<void> {
  const args = [
    ...navegador.args,
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--window-size=1280,800",
    "--virtual-time-budget=5000",
    "--screenshot=" + destinoPng,
    pathToFileURL(arquivoHtml).href,
  ];
  return new Promise<void>((ok, falha) => {
    const filho = spawn(navegador.exe, args, { stdio: "ignore" });
    const relogio = setTimeout(() => {
      filho.kill("SIGKILL");
      falha(new FalhaDeArquivamento("A miniatura passou do tempo limite."));
    }, TEMPO_MINIATURA_MS);
    filho.on("error", () => {
      clearTimeout(relogio);
      falha(new FalhaDeArquivamento(SEM_NAVEGADOR));
    });
    filho.on("close", (codigo: number | null) => {
      clearTimeout(relogio);
      if (codigo === 0) ok();
      else falha(new FalhaDeArquivamento("O navegador não conseguiu gerar a miniatura."));
    });
  });
}
