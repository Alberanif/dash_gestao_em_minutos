/** @jest-environment jsdom */
// Polyfill Web Streams API and TextDecoder for jsdom environment (Node 18+)
import { ReadableStream as NodeReadableStream } from 'stream/web';
import { TextDecoder as NodeTextDecoder, TextEncoder as NodeTextEncoder } from 'util';
// Force-set globals so both the test helpers and the hook implementation use the same classes
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).ReadableStream = NodeReadableStream;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).TextDecoder = NodeTextDecoder;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).TextEncoder = NodeTextEncoder;

import { renderHook, act } from '@testing-library/react';
import { useAgentChat } from '../use-agent-chat';
import type { AgentScopeInput } from '../use-agent-chat';
import { encodeFrame, type AgentFrame } from '@/lib/agent/sse';

/** Bytes crus na rede — o corte entre chunks não respeita fronteira de frame. */
function makeRawStream(chunks: string[]): ReadableStream {
  return new ReadableStream({
    async start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(new TextEncoder().encode(chunk));
      }
      controller.close();
    },
  });
}

/** O que o servidor de verdade manda: frames SSE, um por chunk, e o `done`. */
function makeStream(tokens: string[], extra: AgentFrame[] = []): ReadableStream {
  const frames: AgentFrame[] = [
    ...tokens.map((content): AgentFrame => ({ type: 'token', content })),
    ...extra,
    { type: 'done' },
  ];
  return makeRawStream(frames.map(encodeFrame));
}

/**
 * Um stream que só anda quando o teste manda. O indicador de consulta é efêmero
 * — nasce e morre dentro do stream —, então observá-lo exige poder parar o
 * relógio no meio da resposta, coisa que `makeStream` (que drena de uma vez) não
 * permite.
 */
function makeControlledStream(): {
  stream: ReadableStream;
  push(frame: AgentFrame): Promise<void>;
  close(): Promise<void>;
} {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream({
    start(c) {
      controller = c as ReadableStreamDefaultController<Uint8Array>;
    },
  });

  /** Deixa o loop do hook consumir o que acabou de entrar antes de asseverar. */
  const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

  return {
    stream,
    async push(frame: AgentFrame) {
      controller.enqueue(new TextEncoder().encode(encodeFrame(frame)));
      await settle();
    },
    async close() {
      controller.close();
      await settle();
    },
  };
}

/**
 * Um servidor que emite alguns tokens e depois fica gerando indefinidamente —
 * exatamente o caso em que o usuário desiste. Reproduz o que o `fetch` real faz
 * ao ser abortado: o corpo da resposta é interrompido com um `AbortError`.
 */
function makeAbortableStream(tokens: string[], signal: AbortSignal | undefined): ReadableStream {
  return new ReadableStream({
    start(controller) {
      for (const content of tokens) {
        controller.enqueue(new TextEncoder().encode(encodeFrame({ type: 'token', content })));
      }
      // Nunca fecha: o modelo continuaria escrevendo se ninguém o interrompesse.
      signal?.addEventListener('abort', () => {
        controller.error(Object.assign(new Error('The user aborted a request.'), { name: 'AbortError' }));
      });
    },
  });
}

/** Guarda o `signal` que o hook passou ao fetch, e responde com um stream sem fim. */
function mockNeverEndingFetch(tokens: string[]) {
  const fetchMock = jest.fn((_url: string, init: RequestInit) =>
    Promise.resolve({ ok: true, body: makeAbortableStream(tokens, init.signal ?? undefined) } as unknown as Response)
  );
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

const baseScope: AgentScopeInput = {
  filterId: 'f-1',
  offerCode: null,
  startDate: '2026-01-01',
  endDate: '2026-01-31',
};

beforeEach(() => {
  jest.resetAllMocks();
});

// Behavior 1: sendMessage adds user message immediately
test('sendMessage adiciona mensagem do usuário imediatamente', async () => {
  global.fetch = jest.fn().mockReturnValue(new Promise(() => {})); // never resolves

  const { result } = renderHook(() => useAgentChat());

  act(() => {
    result.current.sendMessage('ola', baseScope);
  });

  expect(result.current.messages[0]).toEqual({ role: 'user', content: 'ola' });
});

// Behavior 2: isStreaming true during fetch and false after
test('isStreaming é true durante fetch e false ao terminar', async () => {
  // Use a controlled promise so we can check isStreaming before it resolves
  let resolveFetch!: (value: unknown) => void;
  const fetchPromise = new Promise((resolve) => { resolveFetch = resolve; });

  global.fetch = jest.fn().mockReturnValue(fetchPromise);

  const { result } = renderHook(() => useAgentChat());

  // Start sendMessage without awaiting
  act(() => {
    result.current.sendMessage('ola', baseScope);
  });

  // isStreaming should be true now — fetch hasn't resolved yet
  expect(result.current.isStreaming).toBe(true);

  // Resolve the fetch and drain
  await act(async () => {
    resolveFetch({ ok: true, body: makeStream(['resposta']) });
    // Give micro-tasks time to settle
    await new Promise((r) => setTimeout(r, 50));
  });

  expect(result.current.isStreaming).toBe(false);
});

// Behavior 3: assistant response accumulated chunk by chunk
test('resposta do assistente é acumulada chunk por chunk', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    body: makeStream(['Ola', ' mundo', '!']),
  } as unknown as Response);

  const { result } = renderHook(() => useAgentChat());

  await act(async () => {
    await result.current.sendMessage('ola', baseScope);
  });

  expect(result.current.messages[1]).toEqual({ role: 'assistant', content: 'Ola mundo!' });
});

// Behavior 4: clearHistory empties messages
test('clearHistory esvazia messages', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    body: makeStream(['resposta']),
  } as unknown as Response);

  const { result } = renderHook(() => useAgentChat());

  await act(async () => {
    await result.current.sendMessage('ola', baseScope);
  });

  expect(result.current.messages.length).toBeGreaterThan(0);

  act(() => {
    result.current.clearHistory();
  });

  expect(result.current.messages).toEqual([]);
});

// Behavior 5: full history sent in body of each request
test('histórico completo é enviado no body de cada request', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    body: makeStream(['ok']),
  } as unknown as Response);

  const { result } = renderHook(() => useAgentChat());

  // first message
  await act(async () => {
    await result.current.sendMessage('msg1', baseScope);
  });

  // reset mock to fresh response
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    body: makeStream(['ok2']),
  } as unknown as Response);

  // second message
  await act(async () => {
    await result.current.sendMessage('msg2', baseScope);
  });

  // reset mock again
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    body: makeStream(['ok3']),
  } as unknown as Response);

  // third message — history should contain the 4 previous messages
  await act(async () => {
    await result.current.sendMessage('msg3', baseScope);
  });

  const thirdCallBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
  // history has: user msg1, assistant ok, user msg2, assistant ok2 — 4 messages
  expect(thirdCallBody.history).toHaveLength(4);
  expect(thirdCallBody.history[0]).toEqual({ role: 'user', content: 'msg1' });
  expect(thirdCallBody.history[1]).toEqual({ role: 'assistant', content: 'ok' });
  expect(thirdCallBody.history[2]).toEqual({ role: 'user', content: 'msg2' });
  expect(thirdCallBody.history[3]).toEqual({ role: 'assistant', content: 'ok2' });
});

// Behavior 6: o cliente manda o id do filtro, nunca o conteúdo dele
test('o body envia filterId e período, e nenhum objeto de filtro nem snapshot de métricas', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    body: makeStream(['ok']),
  } as unknown as Response);

  const { result } = renderHook(() => useAgentChat());

  await act(async () => {
    await result.current.sendMessage('qual a receita?', {
      filterId: 'f-1',
      offerCode: 'OFERTA-X',
      startDate: '2026-06-01',
      endDate: '2026-06-30',
    });
  });

  const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);

  expect(body).toEqual({
    message: 'qual a receita?',
    history: [],
    filterId: 'f-1',
    offerCode: 'OFERTA-X',
    startDate: '2026-06-01',
    endDate: '2026-06-30',
  });
  expect(body).not.toHaveProperty('context');
  expect(body).not.toHaveProperty('filter');
});

// Behavior 7: o frame de erro vira mensagem legível — nunca resposta em branco
test('frame de erro vira mensagem legível no chat', async () => {
  const notice = '⚠️ Não consegui consultar os dados: relation não existe. Tente novamente em instantes.';
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    body: makeStream([], [{ type: 'error', message: notice }]),
  } as unknown as Response);

  const { result } = renderHook(() => useAgentChat());

  await act(async () => {
    await result.current.sendMessage('qual a receita?', baseScope);
  });

  expect(result.current.messages[1]).toEqual({ role: 'assistant', content: notice });
});

// Behavior 8: falha no meio da resposta não apaga o que já tinha sido dito
test('erro depois de tokens preserva a resposta parcial e anexa o aviso', async () => {
  const notice = '⚠️ A consulta demorou mais de 60 segundos e foi interrompida.';
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    body: makeStream(['Em junho ', 'a receita '], [{ type: 'error', message: notice }]),
  } as unknown as Response);

  const { result } = renderHook(() => useAgentChat());

  await act(async () => {
    await result.current.sendMessage('qual a receita?', baseScope);
  });

  expect(result.current.messages[1].content).toBe(`Em junho a receita \n\n${notice}`);
});

// Behavior 9: a rede corta onde quer — um frame partido entre dois chunks não some
test('frame cortado entre dois chunks é remontado pelo cliente', async () => {
  const wire = [
    encodeFrame({ type: 'token', content: 'Ola' }),
    encodeFrame({ type: 'token', content: ' mundo' }),
    encodeFrame({ type: 'done' }),
  ].join('');
  const cut = wire.indexOf('mundo'); // corta no meio do segundo frame

  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    body: makeRawStream([wire.slice(0, cut), wire.slice(cut)]),
  } as unknown as Response);

  const { result } = renderHook(() => useAgentChat());

  await act(async () => {
    await result.current.sendMessage('ola', baseScope);
  });

  expect(result.current.messages[1]).toEqual({ role: 'assistant', content: 'Ola mundo' });
});

// Behavior 11: o frame tool_start acende o indicador com o período consultado
test('tool_start expõe a consulta em andamento, com o período', async () => {
  const wire = makeControlledStream();
  global.fetch = jest.fn().mockResolvedValue({ ok: true, body: wire.stream } as unknown as Response);

  const { result } = renderHook(() => useAgentChat());

  act(() => {
    void result.current.sendMessage('qual a receita de junho?', baseScope);
  });

  expect(result.current.activeQuery).toBeNull();

  await wire.push({
    type: 'tool_start',
    tool: 'getPeriodSummary',
    period: { startDate: '2026-06-01', endDate: '2026-06-30' },
  });

  expect(result.current.activeQuery).toEqual({
    tool: 'getPeriodSummary',
    period: { startDate: '2026-06-01', endDate: '2026-06-30' },
  });

  await wire.push({ type: 'done' });
  await wire.close();
});

// Behavior 12: acabada a consulta, o indicador sai da tela e o texto entra
test('tool_end apaga o indicador antes de o texto começar a chegar', async () => {
  const wire = makeControlledStream();
  global.fetch = jest.fn().mockResolvedValue({ ok: true, body: wire.stream } as unknown as Response);

  const { result } = renderHook(() => useAgentChat());

  act(() => {
    void result.current.sendMessage('qual a receita de junho?', baseScope);
  });

  await wire.push({
    type: 'tool_start',
    tool: 'getPeriodSummary',
    period: { startDate: '2026-06-01', endDate: '2026-06-30' },
  });
  expect(result.current.activeQuery).not.toBeNull();

  await wire.push({ type: 'tool_end', tool: 'getPeriodSummary' });
  expect(result.current.activeQuery).toBeNull();

  await wire.push({ type: 'token', content: 'A receita foi R$ 10.000.' });
  expect(result.current.activeQuery).toBeNull();
  expect(result.current.messages[1].content).toBe('A receita foi R$ 10.000.');

  await wire.push({ type: 'done' });
  await wire.close();
});

// Behavior 13: consulta que morre no meio não deixa o indicador preso na tela
test('stream que acaba durante a consulta não deixa indicador pendurado', async () => {
  const wire = makeControlledStream();
  global.fetch = jest.fn().mockResolvedValue({ ok: true, body: wire.stream } as unknown as Response);

  const { result } = renderHook(() => useAgentChat());

  act(() => {
    void result.current.sendMessage('qual a receita de junho?', baseScope);
  });

  await wire.push({
    type: 'tool_start',
    tool: 'getPeriodSummary',
    period: { startDate: '2026-06-01', endDate: '2026-06-30' },
  });
  expect(result.current.activeQuery).not.toBeNull();

  // A consulta falha: erro e fim do stream, sem nenhum `tool_end` para fechá-la.
  await wire.push({ type: 'error', message: '⚠️ Não consegui consultar os dados.' });
  await wire.push({ type: 'done' });
  await wire.close();

  expect(result.current.isStreaming).toBe(false);
  expect(result.current.activeQuery).toBeNull();
  expect(result.current.messages[1].content).toContain('Não consegui consultar os dados');
});

// Behavior 14: comparativo = duas consultas; o indicador acompanha cada uma
test('duas consultas seguidas: o indicador reflete o período de cada uma', async () => {
  const wire = makeControlledStream();
  global.fetch = jest.fn().mockResolvedValue({ ok: true, body: wire.stream } as unknown as Response);

  const { result } = renderHook(() => useAgentChat());

  act(() => {
    void result.current.sendMessage('compare junho com maio', baseScope);
  });

  await wire.push({
    type: 'tool_start',
    tool: 'getPeriodSummary',
    period: { startDate: '2026-06-01', endDate: '2026-06-30' },
  });
  expect(result.current.activeQuery?.period).toEqual({
    startDate: '2026-06-01',
    endDate: '2026-06-30',
  });

  await wire.push({ type: 'tool_end', tool: 'getPeriodSummary' });

  await wire.push({
    type: 'tool_start',
    tool: 'getPeriodSummary',
    period: { startDate: '2026-05-01', endDate: '2026-05-31' },
  });
  expect(result.current.activeQuery?.period).toEqual({
    startDate: '2026-05-01',
    endDate: '2026-05-31',
  });

  await wire.push({ type: 'tool_end', tool: 'getPeriodSummary' });
  expect(result.current.activeQuery).toBeNull();

  await wire.push({ type: 'token', content: 'Junho superou maio.' });
  await wire.push({ type: 'done' });
  await wire.close();

  expect(result.current.messages[1].content).toBe('Junho superou maio.');
});

// Behavior 10: network error → friendly error message + isStreaming false
test('erro de rede → mensagem de erro amigável e isStreaming false', async () => {
  global.fetch = jest.fn().mockRejectedValue(new Error('network error'));

  const { result } = renderHook(() => useAgentChat());

  await act(async () => {
    await result.current.sendMessage('ola', baseScope);
  });

  expect(result.current.messages[1].role).toBe('assistant');
  expect(result.current.messages[1].content).toContain('Ocorreu um erro');
  expect(result.current.isStreaming).toBe(false);
});

// Behavior 11: parar de propósito interrompe o texto e preserva o que já chegou
test('parar interrompe o streaming e mantém no chat o texto que já tinha chegado', async () => {
  mockNeverEndingFetch(['Em junho ', 'a receita foi ']);

  const { result } = renderHook(() => useAgentChat());

  await act(async () => {
    result.current.sendMessage('qual a receita?', baseScope);
    await new Promise((r) => setTimeout(r, 50));
  });

  expect(result.current.messages[1].content).toBe('Em junho a receita foi ');
  expect(result.current.isStreaming).toBe(true);

  await act(async () => {
    result.current.stop();
    await new Promise((r) => setTimeout(r, 50));
  });

  // Parar não é falhar: o texto parcial fica limpo, sem nenhum aviso de erro.
  expect(result.current.messages).toHaveLength(2);
  expect(result.current.messages[1]).toEqual({
    role: 'assistant',
    content: 'Em junho a receita foi ',
  });
  expect(result.current.isStreaming).toBe(false);
});

// Behavior 12: parar não deixa resíduo — a próxima pergunta funciona normalmente
test('depois de parar, a mensagem seguinte é enviada e respondida normalmente', async () => {
  mockNeverEndingFetch(['Em junho ']);

  const { result } = renderHook(() => useAgentChat());

  await act(async () => {
    result.current.sendMessage('qual a receita?', baseScope);
    await new Promise((r) => setTimeout(r, 50));
  });

  await act(async () => {
    result.current.stop();
    await new Promise((r) => setTimeout(r, 50));
  });

  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    body: makeStream(['Foram 42 vendas.']),
  } as unknown as Response);

  await act(async () => {
    await result.current.sendMessage('e as vendas?', baseScope);
  });

  // O sinal abortado da resposta anterior não pode contaminar a próxima.
  const init = (global.fetch as jest.Mock).mock.calls[0][1] as RequestInit;
  expect(init.signal?.aborted).toBe(false);
  expect(result.current.messages[3]).toEqual({ role: 'assistant', content: 'Foram 42 vendas.' });
  expect(result.current.isStreaming).toBe(false);
});

// A conexão cai no meio da resposta — não é falha do agente (que viria como frame
// `error`), é a rede sumindo. O balão do assistente já existe na tela nesse ponto.
test('queda de rede no meio do stream não deixa um balão vazio no chat', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode(encodeFrame({ type: 'token', content: 'Sua receita foi ' }))
        );
        // A queda vem *depois* de o leitor consumir o que já estava na rede —
        // `error()` síncrono esvaziaria a fila e o token nunca chegaria.
        setTimeout(() => controller.error(new Error('network error')), 0);
      },
    }),
  } as unknown as Response);

  const { result } = renderHook(() => useAgentChat());

  await act(async () => {
    await result.current.sendMessage('qual a receita?', baseScope);
  });

  const doAssistente = result.current.messages.filter((m) => m.role === 'assistant');

  // Um balão, não dois: o aviso entra no que já estava na tela.
  expect(doAssistente).toHaveLength(1);
  expect(doAssistente[0].content).toContain('Sua receita foi');
  expect(doAssistente[0].content).toContain('erro');
  expect(result.current.messages.some((m) => m.content === '')).toBe(false);
});

// Sem placeholder na tela (a rede caiu antes de qualquer byte), o aviso precisa
// virar uma mensagem nova — senão a falha não aparece em lugar nenhum.
test('falha antes do primeiro byte ainda produz mensagem de erro', async () => {
  global.fetch = jest.fn().mockRejectedValue(new Error('network error'));

  const { result } = renderHook(() => useAgentChat());

  await act(async () => {
    await result.current.sendMessage('qual a receita?', baseScope);
  });

  const doAssistente = result.current.messages.filter((m) => m.role === 'assistant');
  expect(doAssistente).toHaveLength(1);
  expect(doAssistente[0].content).toContain('erro');
});

// Comparar dois períodos numa pergunta só faz o modelo emitir dois tool_calls no
// mesmo turno, e o LangGraph roda os dois em paralelo. Os frames se intercalam.
test('com duas consultas em voo, o indicador só apaga quando a última termina', async () => {
  const wire = makeControlledStream();
  global.fetch = jest.fn().mockResolvedValue({ ok: true, body: wire.stream } as unknown as Response);

  const { result } = renderHook(() => useAgentChat());

  act(() => {
    void result.current.sendMessage('compare junho com maio', baseScope);
  });

  await wire.push({
    type: 'tool_start',
    tool: 'getPeriodSummary',
    period: { startDate: '2026-06-01', endDate: '2026-06-30' },
  });
  await wire.push({
    type: 'tool_start',
    tool: 'getPeriodSummary',
    period: { startDate: '2026-05-01', endDate: '2026-05-31' },
  });

  // A primeira volta; a segunda ainda está no banco.
  await wire.push({ type: 'tool_end', tool: 'getPeriodSummary' });

  expect(result.current.activeQuery).not.toBeNull();

  // Só agora o agente parou de consultar.
  await wire.push({ type: 'tool_end', tool: 'getPeriodSummary' });

  expect(result.current.activeQuery).toBeNull();

  await wire.push({ type: 'done' });
  await wire.close();
});
