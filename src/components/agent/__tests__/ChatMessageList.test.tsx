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
});
