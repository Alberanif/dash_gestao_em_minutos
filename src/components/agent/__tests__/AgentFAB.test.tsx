/** @jest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { AgentFAB } from '../AgentFAB';

describe('AgentFAB', () => {
  it('renderiza um botão visível', () => {
    render(<AgentFAB onClick={() => {}} />);
    const btn = screen.getByRole('button');
    expect(btn).toBeTruthy();
  });

  it('chama onClick ao ser clicado', () => {
    const onClick = jest.fn();
    render(<AgentFAB onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
