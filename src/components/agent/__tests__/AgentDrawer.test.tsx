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

  describe('cabeçalho de contexto', () => {
    it('exibe o nome do filtro ativo', () => {
      render(
        <AgentDrawer
          isOpen={true}
          onClose={() => {}}
          filterName="Ingresso PC Ao Vivo"
          startDate="2026-06-01"
          endDate="2026-06-30"
        >
          <span>conteúdo</span>
        </AgentDrawer>,
      );
      expect(screen.getByText(/Filtro: Ingresso PC Ao Vivo/)).toBeTruthy();
    });

    it('exibe o período no formato dia/mês, sem deslocar a data por fuso', () => {
      render(
        <AgentDrawer
          isOpen={true}
          onClose={() => {}}
          filterName="Ingresso PC Ao Vivo"
          startDate="2026-06-01"
          endDate="2026-06-30"
        >
          <span>conteúdo</span>
        </AgentDrawer>,
      );
      expect(screen.getByText(/01\/06–30\/06/)).toBeTruthy();
    });

    it('exibe a oferta ativa quando há uma selecionada', () => {
      render(
        <AgentDrawer
          isOpen={true}
          onClose={() => {}}
          filterName="Ingresso PC Ao Vivo"
          startDate="2026-06-01"
          endDate="2026-06-30"
          offerCode="lote1"
        >
          <span>conteúdo</span>
        </AgentDrawer>,
      );
      expect(screen.getByText(/Oferta: lote1/)).toBeTruthy();
    });

    it('permanece visível sem filtro ativo, sem exibir "undefined"', () => {
      render(
        <AgentDrawer
          isOpen={true}
          onClose={() => {}}
          filterName={null}
          startDate="2026-06-01"
          endDate="2026-06-30"
        >
          <span>conteúdo</span>
        </AgentDrawer>,
      );
      expect(screen.getByText(/Filtro: nenhum · 01\/06–30\/06/)).toBeTruthy();
    });

    it('atualiza quando o filtro e o período mudam no dashboard', () => {
      const { rerender } = render(
        <AgentDrawer
          isOpen={true}
          onClose={() => {}}
          filterName="Ingresso PC Ao Vivo"
          startDate="2026-06-01"
          endDate="2026-06-30"
        >
          <span>conteúdo</span>
        </AgentDrawer>,
      );
      expect(screen.getByText(/Filtro: Ingresso PC Ao Vivo · 01\/06–30\/06/)).toBeTruthy();

      rerender(
        <AgentDrawer
          isOpen={true}
          onClose={() => {}}
          filterName="Mentoria Anual"
          startDate="2026-07-01"
          endDate="2026-07-31"
        >
          <span>conteúdo</span>
        </AgentDrawer>,
      );
      expect(screen.getByText(/Filtro: Mentoria Anual · 01\/07–31\/07/)).toBeTruthy();
      expect(screen.queryByText(/Ingresso PC Ao Vivo/)).toBeNull();
    });
  });
});
