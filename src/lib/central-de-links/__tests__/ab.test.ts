import { classificarDispositivo, ehRobo, navegador, normalizarUrl } from "../ab";

describe("normalizarUrl", () => {
  it("tira www., barra final, query e hash e põe em minúsculas", () => {
    expect(normalizarUrl("https://WWW.Exemplo.com/Oferta/?utm=1#topo")).toBe("exemplo.com/oferta");
  });
  it("tira só o www. do começo do host", () => {
    expect(normalizarUrl("https://blog.www.exemplo.com/")).toBe("blog.www.exemplo.com");
  });
  it("tira várias barras finais", () => {
    expect(normalizarUrl("https://exemplo.com/a///")).toBe("exemplo.com/a");
  });
  it("tira a porta padrão e mantém a não padrão", () => {
    expect(normalizarUrl("https://exemplo.com:443/a")).toBe("exemplo.com/a");
    expect(normalizarUrl("http://exemplo.com:80/a")).toBe("exemplo.com/a");
    expect(normalizarUrl("https://exemplo.com:8443/a")).toBe("exemplo.com:8443/a");
    expect(normalizarUrl("http://exemplo.com:443/a")).toBe("exemplo.com:443/a");
    expect(normalizarUrl("https://exemplo.com:80/a")).toBe("exemplo.com:80/a");
  });
  it("assume https quando falta o protocolo (inclusive com //)", () => {
    expect(normalizarUrl("exemplo.com/a")).toBe("exemplo.com/a");
    expect(normalizarUrl("//exemplo.com/a")).toBe("exemplo.com/a");
  });
  it("http e https dão o mesmo resultado", () => {
    expect(normalizarUrl("http://exemplo.com/a")).toBe(normalizarUrl("https://exemplo.com/a"));
  });
  it("rejeita protocolo que não é http/https", () => {
    expect(normalizarUrl("ftp://exemplo.com/a")).toBeNull();
    expect(normalizarUrl("javascript://exemplo.com/a")).toBeNull();
  });
  it("rejeita vazio, não texto e lixo", () => {
    expect(normalizarUrl("")).toBeNull();
    expect(normalizarUrl("   ")).toBeNull();
    expect(normalizarUrl(null)).toBeNull();
    expect(normalizarUrl(42)).toBeNull();
    expect(normalizarUrl("http://")).toBeNull();
  });
  it("a raiz fica só o host", () => {
    expect(normalizarUrl("https://exemplo.com/")).toBe("exemplo.com");
  });
});

describe("ehRobo", () => {
  it("vazio ou não texto é robô", () => {
    expect(ehRobo("")).toBe(true);
    expect(ehRobo("   ")).toBe(true);
    expect(ehRobo(undefined)).toBe(true);
  });
  it.each([
    "Googlebot/2.1",
    "Mozilla/5.0 (compatible; bingbot/2.0)",
    "facebookexternalhit/1.1",
    "WhatsApp/2.23",
    "curl/8.0",
    "Wget/1.21",
    "python-requests/2.31",
    "HeadlessChrome/120",
    "Mozilla/5.0 Lighthouse",
    "AhrefsBot",
    "Slackbot-LinkExpanding 1.0 preview",
    "node-fetch/1.0",
    "Go-http-client/1.1",
    "UptimeRobot/2.0",
    "okhttp/4.9",
    "Mozilla/5.0 (compatible; YandexBot/3.0)",
    "vercel-screenshot/1.0",
    "AlgumaCoisaBot",
    "Mozilla/5.0 (compatible; MeuCrawler 1.0)",
    "Java/11.0.2",
    "YandexImages/3.0",
    "Uptime-Kuma/1.23",
  ])("detecta robô: %s", (ua) => {
    expect(ehRobo(ua)).toBe(true);
  });
  it.each([
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7; rv:121.0) Gecko/20100101 Firefox/121.0",
  ])("não marca navegador de gente: %s", (ua) => {
    expect(ehRobo(ua)).toBe(false);
  });
});

describe("classificarDispositivo", () => {
  it("tablet: iPad, Kindle, Android sem Mobile", () => {
    expect(classificarDispositivo("Mozilla/5.0 (iPad; CPU OS 17_0)")).toBe("tablet");
    expect(classificarDispositivo("Mozilla/5.0 (Linux; Android 13; SM-T500) Safari")).toBe("tablet");
    expect(classificarDispositivo("Mozilla/5.0 Kindle")).toBe("tablet");
    expect(classificarDispositivo("Mozilla/5.0 Tablet")).toBe("tablet");
  });
  it("celular: iPhone, Android Mobile, Opera Mini, Windows Phone", () => {
    expect(classificarDispositivo("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)")).toBe("celular");
    expect(classificarDispositivo("Mozilla/5.0 (Linux; Android 13; Pixel) Mobile Safari")).toBe("celular");
    expect(classificarDispositivo("Opera Mini/7")).toBe("celular");
    expect(classificarDispositivo("Mozilla/5.0 (Windows Phone 10.0)")).toBe("celular");
    expect(classificarDispositivo("BlackBerry9700")).toBe("celular");
  });
  it("desktop: o resto, inclusive vazio e não texto", () => {
    expect(classificarDispositivo("Mozilla/5.0 (Windows NT 10.0) Chrome/120")).toBe("desktop");
    expect(classificarDispositivo("")).toBe("desktop");
    expect(classificarDispositivo(null)).toBe("desktop");
  });
});

describe("navegador", () => {
  it.each([
    ["Mozilla/5.0 Chrome/120 Safari/537 Edg/120.0", "Edge"],
    ["Mozilla/5.0 (Linux; Android 13) Chrome/120 Mobile Safari/537 EdgA/120", "Edge"],
    ["Mozilla/5.0 (iPhone) Version/17 Mobile EdgiOS/120 Safari", "Edge"],
    ["Mozilla/5.0 Chrome/70 Safari/537 Edge/18.1", "Edge"],
    ["Mozilla/5.0 Chrome/120 Safari/537 OPR/105", "Opera"],
    ["Mozilla/5.0 Chrome/120 SamsungBrowser/23 Safari", "Samsung Internet"],
    ["Mozilla/5.0 Gecko/20100101 Firefox/121.0", "Firefox"],
    ["Mozilla/5.0 (iPhone) FxiOS/121", "Firefox"],
    ["Mozilla/5.0 Chrome/120 Safari/537", "Chrome"],
    ["Mozilla/5.0 (iPhone) CriOS/120", "Chrome"],
    ["Mozilla/5.0 (Macintosh) Version/17 Safari/605", "Safari"],
    ["alguma coisa", "Outro"],
  ])("%s -> %s", (ua, esperado) => {
    expect(navegador(ua)).toBe(esperado);
  });
  it("vazio e não texto são Outro", () => {
    expect(navegador("")).toBe("Outro");
    expect(navegador(undefined)).toBe("Outro");
  });
});
