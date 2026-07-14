/** @jest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatInput } from '../ChatInput';

describe('ChatInput', () => {
  it('desabilita o input quando isStreaming é true', () => {
    render(<ChatInput onSend={() => {}} isStreaming={true} />);
    const textarea = screen.getByTestId('chat-textarea') as HTMLTextAreaElement;
    expect(textarea.disabled).toBe(true);
  });

  it('chama onSend com o texto ao pressionar Enter', () => {
    const onSend = jest.fn();
    render(<ChatInput onSend={onSend} isStreaming={false} />);
    const textarea = screen.getByTestId('chat-textarea');
    fireEvent.change(textarea, { target: { value: 'Minha pergunta' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    expect(onSend).toHaveBeenCalledWith('Minha pergunta');
  });

  it('limpa o campo após enviar', () => {
    render(<ChatInput onSend={() => {}} isStreaming={false} />);
    const textarea = screen.getByTestId('chat-textarea') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Texto qualquer' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    expect(textarea.value).toBe('');
  });

  it('não envia com Shift+Enter', () => {
    const onSend = jest.fn();
    render(<ChatInput onSend={onSend} isStreaming={false} />);
    const textarea = screen.getByTestId('chat-textarea');
    fireEvent.change(textarea, { target: { value: 'Linha 1' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
  });

  it('durante o streaming, oferece parar a geração', () => {
    // Enquanto o agente responde, o único comando útil é interromper: quem já
    // percebeu que a resposta está errada não tem por que esperar o fim dela.
    const onStop = jest.fn();
    render(<ChatInput onSend={() => {}} onStop={onStop} isStreaming={true} />);

    fireEvent.click(screen.getByRole('button', { name: 'Parar geração' }));

    expect(onStop).toHaveBeenCalled();
  });

  it('fora do streaming não há o que parar', () => {
    render(<ChatInput onSend={() => {}} onStop={() => {}} isStreaming={false} />);

    expect(screen.queryByRole('button', { name: 'Parar geração' })).toBeNull();
  });
});
