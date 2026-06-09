/** @jest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { AgentDrawer } from '../AgentDrawer';

describe('AgentDrawer', () => {
  it('não renderiza conteúdo quando isOpen é false', () => {
    render(
      <AgentDrawer isOpen={false} onClose={() => {}}>
        <span>conteúdo interno</span>
      </AgentDrawer>,
    );
    expect(screen.queryByText('conteúdo interno')).toBeNull();
  });

  it('renderiza conteúdo e overlay quando isOpen é true', () => {
    render(
      <AgentDrawer isOpen={true} onClose={() => {}}>
        <span>conteúdo interno</span>
      </AgentDrawer>,
    );
    expect(screen.getByText('conteúdo interno')).toBeTruthy();
    expect(screen.getByTestId('drawer-overlay')).toBeTruthy();
  });

  it('chama onClose ao clicar no overlay', () => {
    const onClose = jest.fn();
    render(
      <AgentDrawer isOpen={true} onClose={onClose}>
        <span>conteúdo</span>
      </AgentDrawer>,
    );
    fireEvent.click(screen.getByTestId('drawer-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('chama onClose ao clicar no botão X', () => {
    const onClose = jest.fn();
    render(
      <AgentDrawer isOpen={true} onClose={onClose}>
        <span>conteúdo</span>
      </AgentDrawer>,
    );
    fireEvent.click(screen.getByTestId('drawer-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
