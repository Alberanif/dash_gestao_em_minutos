"use client";

import { useState } from "react";

interface NewPurchasesToggleProps {
  checked: boolean;
  // Travado (não escondido) para quem não pode editar: o número de "Renovados"
  // depende deste switch, e esconder o motivo é pior que mostrar um controle
  // inerte. Mesmo tratamento do "Vincular à base" na tabela.
  disabled: boolean;
  // Persiste e devolve se deu certo. A aplicação é otimista — quem chama já
  // atualizou a lista de ciclos antes de resolver — então `false` significa que
  // o pai JÁ reverteu e só falta avisar o usuário.
  onChange: (value: boolean) => Promise<boolean>;
}

// Switch "Novas Compras" (migration 053). Mora na barra do ciclo, junto de
// "Carregar base", "Ofertas excluídas" e "Atualizar agora" — é ali que ficam os
// controles de escopo de ciclo, e a vizinhança comunica que ele afeta o
// dashboard inteiro, não só o card ao lado.
export function NewPurchasesToggle({ checked, disabled, onChange }: NewPurchasesToggleProps) {
  const [failed, setFailed] = useState(false);

  async function handleClick() {
    setFailed(false);
    const ok = await onChange(!checked);
    if (!ok) setFailed(true);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        title={disabled ? "Indisponível" : undefined}
        onClick={handleClick}
        className="btn-secondary"
        data-testid="ultimates-new-purchases-toggle"
        style={{ display: "flex", alignItems: "center", gap: 8 }}
      >
        <span
          aria-hidden="true"
          style={{
            position: "relative",
            width: 28,
            height: 16,
            borderRadius: 999,
            flexShrink: 0,
            background: checked ? "var(--orange)" : "var(--surface-2)",
            border: "1px solid var(--border-vis)",
            transition: "background 150ms ease",
          }}
        >
          <span
            style={{
              position: "absolute",
              top: 1,
              left: checked ? 13 : 1,
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: "var(--text-strong)",
              transition: "left 150ms ease",
            }}
          />
        </span>
        Novas Compras
      </button>

      {failed && (
        <span
          role="status"
          data-testid="ultimates-new-purchases-feedback"
          style={{ fontSize: 12, color: "var(--color-danger)" }}
        >
          Não foi possível salvar a configuração.
        </span>
      )}
    </div>
  );
}
