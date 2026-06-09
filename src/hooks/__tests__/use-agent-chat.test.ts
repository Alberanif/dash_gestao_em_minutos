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
import type { DashboardContext } from '../use-agent-chat';

function makeStream(chunks: string[]): ReadableStream {
  return new ReadableStream({
    async start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(new TextEncoder().encode(chunk));
      }
      controller.close();
    },
  });
}

const baseCtx: DashboardContext = {
  activeFilter: null,
  startDate: '2026-01-01',
  endDate: '2026-01-31',
  activePreset: null,
  metaData: null,
  hotmartData: null,
  leadsData: null,
};

beforeEach(() => {
  jest.resetAllMocks();
});

// Behavior 1: sendMessage adds user message immediately
test('sendMessage adiciona mensagem do usuário imediatamente', async () => {
  global.fetch = jest.fn().mockReturnValue(new Promise(() => {})); // never resolves

  const { result } = renderHook(() => useAgentChat());

  act(() => {
    result.current.sendMessage('ola', baseCtx);
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
    result.current.sendMessage('ola', baseCtx);
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
    await result.current.sendMessage('ola', baseCtx);
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
    await result.current.sendMessage('ola', baseCtx);
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
    await result.current.sendMessage('msg1', baseCtx);
  });

  // reset mock to fresh response
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    body: makeStream(['ok2']),
  } as unknown as Response);

  // second message
  await act(async () => {
    await result.current.sendMessage('msg2', baseCtx);
  });

  // reset mock again
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    body: makeStream(['ok3']),
  } as unknown as Response);

  // third message — history should contain the 4 previous messages
  await act(async () => {
    await result.current.sendMessage('msg3', baseCtx);
  });

  const thirdCallBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
  // history has: user msg1, assistant ok, user msg2, assistant ok2 — 4 messages
  expect(thirdCallBody.history).toHaveLength(4);
  expect(thirdCallBody.history[0]).toEqual({ role: 'user', content: 'msg1' });
  expect(thirdCallBody.history[1]).toEqual({ role: 'assistant', content: 'ok' });
  expect(thirdCallBody.history[2]).toEqual({ role: 'user', content: 'msg2' });
  expect(thirdCallBody.history[3]).toEqual({ role: 'assistant', content: 'ok2' });
});

// Behavior 6: network error → friendly error message + isStreaming false
test('erro de rede → mensagem de erro amigável e isStreaming false', async () => {
  global.fetch = jest.fn().mockRejectedValue(new Error('network error'));

  const { result } = renderHook(() => useAgentChat());

  await act(async () => {
    await result.current.sendMessage('ola', baseCtx);
  });

  expect(result.current.messages[1].role).toBe('assistant');
  expect(result.current.messages[1].content).toContain('Ocorreu um erro');
  expect(result.current.isStreaming).toBe(false);
});
