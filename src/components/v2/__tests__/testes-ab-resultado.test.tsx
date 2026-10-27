/** @jest-environment jsdom */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { TelaDeResultado } from "../indicadores/testes-ab/resultado/tela-de-resultado";
import { montarQuery } from "../indicadores/testes-ab/resultado/api-resultado";
import type { ResultadoAb, VarianteDoResultado } from "../indicadores/testes-ab/resultado/tipos";
import { V2Root } from "../ui/v2-root";
import { mockReducedMotion } from "./helpers";

beforeAll(() => {
  mockReducedMotion(false);
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
});

const ID = "11111111-1111-4111-8111-111111111111";

function variante(p: Partial<VarianteDoResultado> & Pick<VarianteDoResultado, "id" | "rotulo">): VarianteDoResultado {
  return {
    controle: false,
    link_id: "l-" + p.id,
    pagina: "Página " + p.rotulo,
    url: "https://ex.com/" + p.rotulo.toLowerCase(),
    visualizacoes: 0,
    unicos: 0,
    novos: 0,
    recorrentes: 0,
    leads: 0,
    envios: 0,
    conversao: 0,
    funil: { visitaram: 0, comecaram: 0, enviaram: 0 },
    estatistica: { diferenca_abs: null, diferenca_rel: null, p_valor: null, confianca: null, faltam: null, veredito: null },
    serie: [],
    cortes: [],
    saude: { ultimo_evento: null, horas_sem_evento: null, alerta: false },
    ...p,
  };
}

const A = variante({
  id: "va",
  rotulo: "A",
  controle: true,
  visualizacoes: 140,
  unicos: 100,
  novos: 70,
  recorrentes: 30,
  leads: 10,
  envios: 11,
  conversao: 0.1,
  funil: { visitaram: 100, comecaram: 40, enviaram: 10 },
  estatistica: { diferenca_abs: null, diferenca_rel: null, p_valor: null, confianca: null, faltam: 400, veredito: null },
  serie: [
    { dia: "2026-10-02", visitantes: 60, leads: 5, conversao: 0.0833 },
    { dia: "2026-10-03", visitantes: 40, leads: 5, conversao: 0.125 },
  ],
  cortes: [
    { dimensao: "utm_source", valor: "instagram", visitantes: 80, leads: 8, conversao: 0.1 },
    { dimensao: "utm_source", valor: null, visitantes: 20, leads: 2, conversao: 0.1 },
    { dimensao: "dispositivo", valor: "mobile", visitantes: 100, leads: 10, conversao: 0.1 },
  ],
  saude: { ultimo_evento: "2026-10-03T18:00:00Z", horas_sem_evento: 1.2, alerta: false },
});
const B = variante({
  id: "vb",
  rotulo: "B",
  visualizacoes: 150,
  unicos: 110,
  novos: 90,
  recorrentes: 20,
  leads: 22,
  conversao: 0.2,
  funil: { visitaram: 110, comecaram: 60, enviaram: 22 },
  estatistica: { diferenca_abs: 0.1, diferenca_rel: 1, p_valor: 0.03, confianca: 0.97, faltam: 0, veredito: null },
  serie: [{ dia: "2026-10-02", visitantes: 110, leads: 22, conversao: 0.2 }],
  cortes: [{ dimensao: "utm_source", valor: "instagram", visitantes: 110, leads: 22, conversao: 0.2 }],
  saude: { ultimo_evento: "2026-10-03T18:00:00Z", horas_sem_evento: 1.2, alerta: false },
});

function resultado(p: Partial<ResultadoAb> = {}): ResultadoAb {
  return {
    teste: {
      id: ID,
      nome: "Teste da Home",
      status: "ativo",
      iniciado_em: "2026-10-02T15:00:00Z",
      encerrado_em: null,
      vencedor_variante: null,
      anotacao: null,
    },
    filtros_aplicados: {},
    filtros_disponiveis: { utm_source: ["instagram", "google"], utm_medium: [], utm_campaign: [], dispositivo: ["mobile"], pais: ["BR"] },
    veredito: { resultado: "cedo_demais", vencedor_id: null, avisos: [], confianca_minima: 0.95, amostra_minima: 500, controle_id: "va" },
    horas_sem_evento_alerta: 6,
    variantes: [B, A], // fora de ordem de propósito: a tela ordena por rótulo
    ...p,
  };
}

const resp = (status: number, corpo: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => corpo }) as unknown as Response;
const fetchMock = jest.fn();
const fetchOriginal = global.fetch;

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => resp(200, resultado()));
  global.fetch = fetchMock as unknown as typeof fetch;
});
afterEach(() => {
  cleanup();
  global.fetch = fetchOriginal;
});

async function abrir(r: ResultadoAb = resultado()) {
  fetchMock.mockImplementation(async () => resp(200, r));
  render(
    <V2Root>
      <TelaDeResultado testeId={ID} />
    </V2Root>,
  );
  await screen.findByRole("heading", { name: r.teste.nome });
}

const urlDaChamada = (n: number) => String(fetchMock.mock.calls[n][0]);

describe("busca", () => {
  it("monta a query só com os filtros preenchidos", () => {
    expect(montarQuery(ID, {})).toBe(`teste=${ID}`);
    expect(montarQuery(ID, { pais: "BR", utm_source: "ig", dispositivo: "" })).toBe(`teste=${ID}&utm_source=ig&pais=BR`);
  });

  it("mostra 'Carregando' e depois busca o teste certo no endpoint da central", async () => {
    await abrir();
    expect(urlDaChamada(0)).toBe(`/api/central-de-links/ab-resultado?teste=${ID}`);
  });
});

describe("cabeçalho e comparativo", () => {
  it("mostra nome, estado, datas em São Paulo e link de volta", async () => {
    await abrir();
    expect(screen.getByText("Ativo")).toBeTruthy();
    expect(screen.getByText("02/10/2026 até agora")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Voltar para os testes/ }).getAttribute("href")).toBe("/v2/indicadores/testes-ab");
  });

  it("encerrado mostra o vencedor registrado e a anotação", async () => {
    await abrir(
      resultado({
        teste: {
          id: ID, nome: "Teste Fechado", status: "encerrado", iniciado_em: "2026-10-02T15:00:00Z",
          encerrado_em: "2026-10-09T15:00:00Z", vencedor_variante: "vb", anotacao: "B ganhou folgado",
        },
      }),
    );
    expect(screen.getByText("Vencedor registrado: B")).toBeTruthy();
    expect(screen.getByText(/B ganhou folgado/)).toBeTruthy();
    expect(screen.getByText("02/10/2026 a 09/10/2026")).toBeTruthy();
  });

  it("encerrado sem vencedor diz que não houve diferença", async () => {
    await abrir(
      resultado({
        teste: {
          id: ID, nome: "Teste Empate", status: "encerrado", iniciado_em: "2026-10-02T15:00:00Z",
          encerrado_em: "2026-10-09T15:00:00Z", vencedor_variante: null, anotacao: null,
        },
      }),
    );
    expect(screen.getByText("Encerrado sem diferença entre as variantes")).toBeTruthy();
  });

  it("variantes saem em ordem de rótulo com os números e a diferença contra o controle", async () => {
    await abrir();
    const cards = screen.getAllByTestId("variante");
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByText("Variante A")).toBeTruthy();
    expect(within(cards[0]).getByText("10,00%")).toBeTruthy();
    expect(within(cards[0]).getAllByText("Controle")).toHaveLength(2); // selo e linha da diferença
    expect(within(cards[0]).getByText("70 / 30")).toBeTruthy();
    expect(within(cards[1]).getByText("20,00%")).toBeTruthy();
    expect(within(cards[1]).getByText("90 / 20")).toBeTruthy();
    expect(within(cards[1]).getByText(/▲ \+100,0% vs controle/)).toBeTruthy();
  });

  it("diferença negativa aparece com seta para baixo", async () => {
    const pior = { ...B, estatistica: { ...B.estatistica, diferenca_rel: -0.25 } };
    await abrir(resultado({ variantes: [A, pior] }));
    expect(screen.getByText(/▼ -25,0% vs controle/)).toBeTruthy();
  });
});

describe("veredito", () => {
  it("'Cedo demais' diz quantos visitantes faltam", async () => {
    await abrir();
    const v = screen.getByTestId("veredito");
    expect(within(v).getByText("Cedo demais para decidir")).toBeTruthy();
    expect(within(v).getByText(/mínimo de 500 por variante/)).toBeTruthy();
    expect(within(v).getByText(/Faltam cerca de 400 visitantes por variante/)).toBeTruthy();
  });

  it("vencedor mostra a melhora e a confiança", async () => {
    await abrir(
      resultado({ veredito: { resultado: "vencedor", vencedor_id: "vb", avisos: ["Teste curto"], confianca_minima: 0.95, amostra_minima: 500, controle_id: "va" } }),
    );
    const v = screen.getByTestId("veredito");
    expect(within(v).getByText("A variante B venceu")).toBeTruthy();
    expect(within(v).getByText(/B está 100,0% melhor que A, com confiança de 97,0% \(mínimo exigido: 95%\)/)).toBeTruthy();
    expect(within(v).getByText("Teste curto")).toBeTruthy();
    expect(within(screen.getAllByTestId("variante")[1]).getByText("Vencedora")).toBeTruthy();
  });

  it("sem diferença não promete vencedor", async () => {
    await abrir(resultado({ veredito: { resultado: "sem_diferenca", vencedor_id: null, avisos: [], confianca_minima: 0.95, amostra_minima: 500, controle_id: "va" } }));
    expect(screen.getByText("Ainda sem diferença significativa")).toBeTruthy();
    expect(screen.queryByText(/venceu/)).toBeNull();
  });
});

describe("gráfico por dia", () => {
  it("'Ver tabela' troca o gráfico pela tabela equivalente e volta", async () => {
    await abrir();
    expect(screen.getByRole("group", { name: /Conversão por dia/ })).toBeTruthy();
    const botao = screen.getByRole("button", { name: "Ver tabela" });
    expect(botao.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(botao);
    const tabela = screen.getByRole("table", { name: "Conversão por dia" });
    expect(screen.queryByRole("group", { name: /Conversão por dia/ })).toBeNull();
    expect(within(tabela).getByText("02/10")).toBeTruthy();
    expect(within(tabela).getByText("8,3%")).toBeTruthy(); // A em 02/10
    expect(within(tabela).getByText("20,0%")).toBeTruthy(); // B em 02/10
    expect(within(tabela).getAllByText("—").length).toBe(1); // B não tem 03/10
    const voltar = screen.getByRole("button", { name: "Ver gráfico" });
    expect(voltar.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(voltar);
    expect(screen.getByRole("group", { name: /Conversão por dia/ })).toBeTruthy();
  });

  it("trocar a métrica muda a tabela para visitantes", async () => {
    await abrir();
    fireEvent.click(screen.getByRole("button", { name: "Visitantes" }));
    fireEvent.click(screen.getByRole("button", { name: "Ver tabela" }));
    const tabela = screen.getByRole("table", { name: "Visitantes por dia" });
    expect(within(tabela).getByText("110")).toBeTruthy();
    expect(within(tabela).getByText("60")).toBeTruthy();
  });

  it("sem série nenhuma mostra 'Sem eventos no período'", async () => {
    await abrir(resultado({ variantes: [{ ...A, serie: [] }, { ...B, serie: [] }] }));
    expect(screen.getByText("Sem eventos no período.")).toBeTruthy();
  });
});

describe("cortes e funil", () => {
  it("cortes por dimensão, com '(não informado)' e só as dimensões que têm dados", async () => {
    await abrir();
    const origem = screen.getByTestId("corte-utm_source");
    expect(within(origem).getByText("instagram")).toBeTruthy();
    expect(within(origem).getByText("(não informado)")).toBeTruthy();
    expect(within(origem).getByText("80 / 8 / 10,0%")).toBeTruthy();
    expect(within(origem).getByText("110 / 22 / 20,0%")).toBeTruthy();
    expect(within(origem).getByText("0 / 0 / —")).toBeTruthy(); // B não tem "(não informado)"
    expect(screen.getByTestId("corte-dispositivo")).toBeTruthy();
    expect(screen.queryByTestId("corte-pais")).toBeNull();
  });

  it("valores de cada corte saem dos mais visitados para os menos", async () => {
    const a = { ...A, cortes: [
      { dimensao: "pais", valor: "PT", visitantes: 5, leads: 0, conversao: 0 },
      { dimensao: "pais", valor: "BR", visitantes: 90, leads: 9, conversao: 0.1 },
      { dimensao: "pais", valor: "US", visitantes: 30, leads: 3, conversao: 0.1 },
    ] };
    await abrir(resultado({ variantes: [a, { ...B, cortes: [] }] }));
    const linhas = within(screen.getByTestId("corte-pais")).getAllByRole("row").slice(1);
    expect(linhas.map((l) => l.querySelector("td")!.textContent)).toEqual(["BR", "US", "PT"]);
  });

  it("funil mostra as três etapas de cada variante", async () => {
    await abrir();
    const funis = screen.getAllByTestId("funil-variante");
    expect(funis).toHaveLength(2);
    expect(within(funis[0]).getByText("Funil da variante A", { exact: false })).toBeTruthy();
    const tabela = within(funis[1]).getByRole("table", { hidden: true });
    expect(tabela.textContent).toContain("Começaram a preencher");
    expect(tabela.textContent).toContain("60");
    expect(tabela.textContent).toContain("22");
  });
});

describe("saúde da instalação", () => {
  it("sem eventos diz 'Nenhum evento recebido ainda' e não alarma em rascunho", async () => {
    await abrir(
      resultado({
        teste: { id: ID, nome: "Rascunho", status: "rascunho", iniciado_em: null, encerrado_em: null, vencedor_variante: null, anotacao: null },
        variantes: [variante({ id: "va", rotulo: "A", controle: true }), variante({ id: "vb", rotulo: "B" })],
      }),
    );
    const linhas = screen.getAllByTestId("saude");
    expect(linhas).toHaveLength(2);
    for (const l of linhas) {
      expect(within(l).getByText(/Nenhum evento recebido ainda\./)).toBeTruthy();
      expect(l.getAttribute("data-alerta")).toBe("false");
    }
    expect(screen.getByText(/O teste ainda é um rascunho/)).toBeTruthy();
  });

  it("alerta cita as horas sem evento e o limite", async () => {
    const mudo = { ...B, saude: { ultimo_evento: "2026-10-01T10:00:00Z", horas_sem_evento: 30.5, alerta: true } };
    await abrir(resultado({ variantes: [A, mudo] }));
    const linhas = screen.getAllByTestId("saude");
    expect(linhas[0].getAttribute("data-alerta")).toBe("false");
    expect(within(linhas[0]).getByText("Tudo certo")).toBeTruthy();
    expect(linhas[1].getAttribute("data-alerta")).toBe("true");
    expect(within(linhas[1]).getByText("Atenção")).toBeTruthy();
    expect(within(linhas[1]).getByText(/Sem eventos há 30,5 h \(limite: 6 h\)/)).toBeTruthy();
    expect(linhas[1].getAttribute("role")).toBe("alert");
    expect(linhas[0].getAttribute("role")).toBeNull();
  });

  it("alerta sem nenhum evento (ativo) pede para conferir o snippet", async () => {
    const semNada = variante({ id: "vb", rotulo: "B", saude: { ultimo_evento: null, horas_sem_evento: null, alerta: true } });
    await abrir(resultado({ variantes: [A, semNada] }));
    const linha = screen.getAllByTestId("saude")[1];
    expect(within(linha).getByText(/Nenhum evento recebido ainda\./)).toBeTruthy();
    expect(within(linha).getByText(/Confira se o snippet está na página e se a URL/)).toBeTruthy();
  });
});

describe("filtros", () => {
  it("escolher um filtro refaz a busca com a query certa; limpar volta ao início", async () => {
    await abrir();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(screen.getByRole("combobox", { name: "País" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("option", { name: "BR" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(urlDaChamada(1)).toBe(`/api/central-de-links/ab-resultado?teste=${ID}&pais=BR`);

    await waitFor(() => expect((screen.getByRole("button", { name: "Limpar filtros" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Origem (utm_source)" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("option", { name: "instagram" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(urlDaChamada(2)).toBe(`/api/central-de-links/ab-resultado?teste=${ID}&utm_source=instagram&pais=BR`);

    await waitFor(() => expect((screen.getByRole("button", { name: "Limpar filtros" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
    expect(urlDaChamada(3)).toBe(`/api/central-de-links/ab-resultado?teste=${ID}`);
  });

  it("escolher 'Todos' num filtro aplicado tira só aquele filtro da busca", async () => {
    await abrir();
    fireEvent.keyDown(screen.getByRole("combobox", { name: "País" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("option", { name: "BR" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect((screen.getByRole("combobox", { name: "País" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.keyDown(screen.getByRole("combobox", { name: "País" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("option", { name: "Todos" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(urlDaChamada(2)).toBe(`/api/central-de-links/ab-resultado?teste=${ID}`);
  });

  it("o filtro escolhido continua selecionado mesmo que a resposta não o liste entre os disponíveis", async () => {
    await abrir();
    fetchMock.mockImplementation(async () =>
      resp(200, resultado({ filtros_disponiveis: { utm_source: [], utm_medium: [], utm_campaign: [], dispositivo: [], pais: [] } })),
    );
    fireEvent.keyDown(screen.getByRole("combobox", { name: "País" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("option", { name: "BR" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect((screen.getByRole("combobox", { name: "País" }) as HTMLButtonElement).disabled).toBe(false));
    expect(screen.getByRole("combobox", { name: "País" }).textContent).toContain("BR");
  });

  it("'Limpar filtros' começa desabilitado", async () => {
    await abrir();
    expect((screen.getByRole("button", { name: "Limpar filtros" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("estados", () => {
  it("carregando enquanto a primeira resposta não chega", async () => {
    let soltar: (r: Response) => void = () => {};
    fetchMock.mockImplementation(() => new Promise<Response>((res) => (soltar = res)));
    render(
      <V2Root>
        <TelaDeResultado testeId={ID} />
      </V2Root>,
    );
    expect(screen.getByText("Carregando resultado…")).toBeTruthy();
    soltar(resp(200, resultado()));
    await screen.findByRole("heading", { name: "Teste da Home" });
    expect(screen.queryByText("Carregando resultado…")).toBeNull();
  });

  it("erro do servidor aparece com 'Tentar de novo', que busca outra vez", async () => {
    fetchMock.mockImplementationOnce(async () => resp(404, { erro: "Teste não encontrado." }));
    render(
      <V2Root>
        <TelaDeResultado testeId={ID} />
      </V2Root>,
    );
    expect((await screen.findByRole("alert")).textContent).toBe("Teste não encontrado.");
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    await screen.findByRole("heading", { name: "Teste da Home" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("falha de rede vira mensagem em português", async () => {
    fetchMock.mockImplementationOnce(async () => {
      throw new TypeError("failed");
    });
    render(
      <V2Root>
        <TelaDeResultado testeId={ID} />
      </V2Root>,
    );
    expect((await screen.findByRole("alert")).textContent).toBe("Sem conexão com o servidor. Tente de novo.");
  });

  it("401 com { error } (forma do guarda) também mostra a mensagem", async () => {
    fetchMock.mockImplementationOnce(async () => resp(401, { error: "Não autenticado." }));
    render(
      <V2Root>
        <TelaDeResultado testeId={ID} />
      </V2Root>,
    );
    expect((await screen.findByRole("alert")).textContent).toBe("Não autenticado.");
  });

  it("teste sem eventos (tudo zerado) renderiza sem erro", async () => {
    await abrir(
      resultado({
        veredito: { resultado: "cedo_demais", vencedor_id: null, avisos: [], confianca_minima: 0.95, amostra_minima: 500, controle_id: "va" },
        variantes: [variante({ id: "va", rotulo: "A", controle: true }), variante({ id: "vb", rotulo: "B" })],
      }),
    );
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getAllByText("0,00%")).toHaveLength(2);
    expect(screen.getByText("Sem eventos no período.")).toBeTruthy();
    expect(screen.getByText("Sem dados para recortar ainda.")).toBeTruthy();
  });
});
