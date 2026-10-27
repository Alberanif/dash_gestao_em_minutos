import { EventEmitter } from "events";

const mockSpawn = jest.fn();
jest.mock("child_process", () => ({ spawn: (...a: unknown[]) => mockSpawn(...a) }));

const mockExecutablePath = jest.fn();
jest.mock("@sparticuz/chromium", () => ({
  __esModule: true,
  default: {
    args: ["--no-sandbox", "--headless='shell'", "--headless", "--single-process"],
    executablePath: (...a: unknown[]) => mockExecutablePath(...a),
  },
}));

import { capturar, capturarMiniatura, localizarNavegador } from "../captura";
import { FalhaDeArquivamento, TEMPO_CAPTURA_MS } from "../arquivamento";

function filhoFalso() {
  const filho = new EventEmitter() as EventEmitter & { stderr: EventEmitter; kill: jest.Mock };
  filho.stderr = new EventEmitter();
  filho.kill = jest.fn();
  return filho;
}

const ORIGINAL_CHROME = process.env.CHROME_PATH;
beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
  delete process.env.CHROME_PATH;
});
afterAll(() => {
  if (ORIGINAL_CHROME === undefined) delete process.env.CHROME_PATH;
  else process.env.CHROME_PATH = ORIGINAL_CHROME;
});

describe("localizarNavegador", () => {
  it("usa CHROME_PATH quando definido, sem argumentos extras", async () => {
    process.env.CHROME_PATH = "C:\\chrome.exe";
    expect(await localizarNavegador()).toEqual({ exe: "C:\\chrome.exe", args: [] });
    expect(mockExecutablePath).not.toHaveBeenCalled();
  });

  it("sem CHROME_PATH usa o Chromium empacotado e remove --headless dos argumentos", async () => {
    mockExecutablePath.mockResolvedValue("/tmp/chromium");
    const nav = await localizarNavegador();
    expect(nav.exe).toBe("/tmp/chromium");
    expect(nav.args).toEqual(["--no-sandbox", "--single-process"]);
  });

  it("se o Chromium não puder ser iniciado, vira FalhaDeArquivamento clara", async () => {
    mockExecutablePath.mockRejectedValue(new Error("boom"));
    const p = localizarNavegador();
    await expect(p).rejects.toBeInstanceOf(FalhaDeArquivamento);
    await expect(p).rejects.toThrow(/O navegador de captura não está disponível neste ambiente\./);
  });
});

describe("capturar", () => {
  it("dispara o single-file com o node atual, url, destino e o navegador", async () => {
    const filho = filhoFalso();
    mockSpawn.mockReturnValue(filho);
    const p = capturar("https://exemplo.com/x", "/tmp/a.html", { exe: "/bin/chrome", args: [] });
    filho.emit("close", 0);
    await expect(p).resolves.toBeUndefined();

    const [exe, args] = mockSpawn.mock.calls[0];
    expect(exe).toBe(process.execPath);
    expect(args[0]).toMatch(/single-file-node\.js$/);
    expect(args.slice(1, 3)).toEqual(["https://exemplo.com/x", "/tmp/a.html"]);
    expect(args).toContain("--browser-executable-path=/bin/chrome");
    expect(args).toContain("--filename-conflict-action=overwrite");
    expect(args.some((a: string) => a.startsWith("--browser-args="))).toBe(false);
  });

  it("repassa os argumentos do navegador em JSON", async () => {
    const filho = filhoFalso();
    mockSpawn.mockReturnValue(filho);
    const p = capturar("https://e.com", "/tmp/a.html", { exe: "/c", args: ["--no-sandbox"] });
    filho.emit("close", 0);
    await p;
    expect(mockSpawn.mock.calls[0][1]).toContain('--browser-args=["--no-sandbox"]');
  });

  it("código de saída diferente de zero falha com a última linha do stderr", async () => {
    const filho = filhoFalso();
    mockSpawn.mockReturnValue(filho);
    const p = capturar("https://e.com", "/tmp/a.html", { exe: "/c", args: [] });
    filho.stderr.emit("data", Buffer.from("linha 1\nChrome travou"));
    filho.emit("close", 1);
    await expect(p).rejects.toBeInstanceOf(FalhaDeArquivamento);
    await expect(p).rejects.toThrow("O navegador não conseguiu capturar a página. Chrome travou");
  });

  it("erro ao iniciar o processo vira FalhaDeArquivamento de navegador indisponível", async () => {
    const filho = filhoFalso();
    mockSpawn.mockReturnValue(filho);
    const p = capturar("https://e.com", "/tmp/a.html", { exe: "/c", args: [] });
    filho.emit("error", new Error("spawn ENOENT"));
    await expect(p).rejects.toBeInstanceOf(FalhaDeArquivamento);
    await expect(p).rejects.toThrow(/navegador de captura não está disponível/);
  });

  it("estourar o tempo mata o processo com SIGKILL e falha", async () => {
    jest.useFakeTimers();
    const filho = filhoFalso();
    mockSpawn.mockReturnValue(filho);
    const p = capturar("https://e.com", "/tmp/a.html", { exe: "/c", args: [] });
    const resultado = p.catch((e) => e);
    jest.advanceTimersByTime(TEMPO_CAPTURA_MS - 1);
    expect(filho.kill).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(filho.kill).toHaveBeenCalledWith("SIGKILL");
    const erro = await resultado;
    expect(erro).toBeInstanceOf(FalhaDeArquivamento);
    expect(erro.message).toBe("A captura passou do tempo limite.");
  });
});

describe("capturarMiniatura", () => {
  it("abre a cópia local no navegador e pede só a imagem (nada de rede)", async () => {
    const filho = filhoFalso();
    mockSpawn.mockReturnValue(filho);
    const p = capturarMiniatura("/tmp/pagina.html", "/tmp/pagina.png", { exe: "/chrome", args: ["--no-sandbox"] });
    filho.emit("close", 0);
    await expect(p).resolves.toBeUndefined();
    const [exe, args] = mockSpawn.mock.calls[0] as [string, string[]];
    expect(exe).toBe("/chrome");
    expect(args).toEqual(expect.arrayContaining(["--no-sandbox", "--headless=new", "--screenshot=/tmp/pagina.png", "--window-size=1280,800"]));
    expect(args[args.length - 1]).toMatch(/^file:\/\/\/.*pagina\.html$/);
    expect(args.some((a) => /^https?:/.test(a))).toBe(false);
  });

  it("navegador que sai com erro vira FalhaDeArquivamento", async () => {
    const filho = filhoFalso();
    mockSpawn.mockReturnValue(filho);
    const p = capturarMiniatura("/tmp/a.html", "/tmp/a.png", { exe: "/chrome", args: [] });
    filho.emit("close", 1);
    await expect(p).rejects.toBeInstanceOf(FalhaDeArquivamento);
  });

  it("navegador que não inicia vira a mensagem de ambiente sem navegador", async () => {
    const filho = filhoFalso();
    mockSpawn.mockReturnValue(filho);
    const p = capturarMiniatura("/tmp/a.html", "/tmp/a.png", { exe: "/nada", args: [] });
    filho.emit("error", new Error("ENOENT"));
    await expect(p).rejects.toThrow(/navegador de captura não está disponível/);
  });

  it("passou de 60 s: mata o navegador e falha", async () => {
    jest.useFakeTimers();
    const filho = filhoFalso();
    mockSpawn.mockReturnValue(filho);
    const p = capturarMiniatura("/tmp/a.html", "/tmp/a.png", { exe: "/chrome", args: [] });
    const visto = expect(p).rejects.toThrow(/tempo limite/);
    jest.advanceTimersByTime(60_000);
    await visto;
    expect(filho.kill).toHaveBeenCalledWith("SIGKILL");
    jest.useRealTimers();
  });
});
