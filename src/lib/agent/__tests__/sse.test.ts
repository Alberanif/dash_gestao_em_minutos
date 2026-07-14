import { encodeFrame, createFrameParser, type AgentFrame } from "../sse";

describe("contrato SSE", () => {
  it("round-trip: codificar e parsear devolve o frame idêntico", () => {
    const frame: AgentFrame = { type: "token", content: "Sua receita foi R$ 250." };

    const parsed = createFrameParser().push(encodeFrame(frame));

    expect(parsed).toEqual([frame]);
  });

  it("um frame cortado no meio entre duas leituras é remontado", () => {
    const wire = encodeFrame({ type: "token", content: "receita" });
    const cut = Math.floor(wire.length / 2);
    const parser = createFrameParser();

    // A rede não respeita fronteira de frame: o primeiro pedaço não é parseável
    // sozinho, e descartá-lo perderia um token da resposta.
    expect(parser.push(wire.slice(0, cut))).toEqual([]);
    expect(parser.push(wire.slice(cut))).toEqual([{ type: "token", content: "receita" }]);
  });

  it("vários frames num mesmo chunk são entregues todos, na ordem", () => {
    // `tool_start` carrega o período consultado: é o que permite ao chat dizer
    // "Consultando dados de 01/06 a 30/06..." em vez de um spinner mudo.
    const frames: AgentFrame[] = [
      { type: "tool_start", tool: "getPeriodSummary", period: { startDate: "2026-06-01", endDate: "2026-06-30" } },
      { type: "tool_end", tool: "getPeriodSummary" },
      { type: "token", content: "R$ 250." },
      { type: "done" },
    ];

    const parsed = createFrameParser().push(frames.map(encodeFrame).join(""));

    expect(parsed).toEqual(frames);
  });

  it("o frame de erro atravessa o transporte intacto", () => {
    // Quebras de linha e emoji sobrevivem: o texto do erro é o que o usuário lê.
    const frame: AgentFrame = {
      type: "error",
      message: "⚠️ Não consegui consultar os dados: relation does not exist.\n\nTente novamente.",
    };

    expect(createFrameParser().push(encodeFrame(frame))).toEqual([frame]);
  });
});
