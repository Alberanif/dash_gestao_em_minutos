/** @jest-environment jsdom */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { ChatMessageList } from '../ChatMessageList';
import type { Message } from '@/hooks/use-agent-chat';

describe('ChatMessageList', () => {
  it('renderiza mensagens de usuário e assistente corretamente', () => {
    const messages: Message[] = [
      { role: 'user', content: 'Olá, tudo bem?' },
      { role: 'assistant', content: 'Tudo bem, obrigado!' },
    ];
    render(<ChatMessageList messages={messages} />);
    expect(screen.getByText('Olá, tudo bem?')).toBeTruthy();
    expect(screen.getByText('Tudo bem, obrigado!')).toBeTruthy();
    expect(screen.getByText('Analista')).toBeTruthy();
  });

  it('renderiza **negrito** como <strong> nas mensagens do assistente', () => {
    const messages: Message[] = [
      { role: 'assistant', content: 'Este é um **texto em negrito** aqui.' },
    ];
    const { container } = render(<ChatMessageList messages={messages} />);
    const strong = container.querySelector('strong');
    expect(strong).toBeTruthy();
    expect(strong!.textContent).toBe('texto em negrito');
  });

  it('renderiza listas markdown como <ul>/<li>', () => {
    const messages: Message[] = [
      { role: 'assistant', content: '- Item A\n- Item B\n- Item C' },
    ];
    const { container } = render(<ChatMessageList messages={messages} />);
    const items = container.querySelectorAll('li');
    expect(items.length).toBe(3);
    expect(items[0].textContent).toBe('Item A');
    expect(items[2].textContent).toBe('Item C');
  });

  it('renderiza cabeçalhos markdown como <h3>', () => {
    const messages: Message[] = [
      { role: 'assistant', content: '### Resumo\nConteúdo aqui.' },
    ];
    const { container } = render(<ChatMessageList messages={messages} />);
    const h3 = container.querySelector('h3');
    expect(h3).toBeTruthy();
    expect(h3!.textContent).toBe('Resumo');
  });

  it('renderiza tabela GFM como <table>', () => {
    const messages: Message[] = [
      {
        role: 'assistant',
        content: '| Métrica | Valor |\n|---|---|\n| CPL | R$ 10 |',
      },
    ];
    const { container } = render(<ChatMessageList messages={messages} />);
    expect(container.querySelector('table')).toBeTruthy();
    expect(container.querySelector('th')).toBeTruthy();
    expect(container.querySelector('td')).toBeTruthy();
  });

  it('lista vazia não quebra', () => {
    const { container } = render(<ChatMessageList messages={[]} />);
    expect(container).toBeTruthy();
  });

  it('durante uma consulta, mostra o período que está sendo consultado', () => {
    render(
      <ChatMessageList
        messages={[{ role: 'user', content: 'qual a receita de junho?' }]}
        activeQuery={{
          tool: 'getPeriodSummary',
          period: { startDate: '2026-06-01', endDate: '2026-06-30' },
        }}
      />,
    );
    expect(screen.getByText('Consultando dados de 01/06 a 30/06...')).toBeTruthy();
  });

  it('sem consulta em andamento, não mostra indicador', () => {
    render(<ChatMessageList messages={[{ role: 'assistant', content: 'Pronto.' }]} />);
    expect(screen.queryByTestId('agent-query-indicator')).toBeNull();
  });

  it('consulta sem período legível avisa mesmo assim — sem "undefined" nem "Invalid Date"', () => {
    render(
      <ChatMessageList
        messages={[]}
        activeQuery={{ tool: 'getPeriodSummary', period: null }}
      />,
    );
    const indicator = screen.getByTestId('agent-query-indicator');
    expect(indicator.textContent).toContain('Consultando dados');
    expect(indicator.textContent).not.toContain('undefined');
    expect(indicator.textContent).not.toContain('Invalid Date');
    expect(indicator.textContent).not.toContain('null');
  });
});
