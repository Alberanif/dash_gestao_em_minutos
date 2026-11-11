"use client";

import * as RSelect from "@radix-ui/react-select";
import { usePortalContainer } from "./v2-root";
import { cx, foco } from "./cx";

type Opcao = {
  value: string;
  label: string;
  disabled?: boolean;
  /** Rótulo do grupo. Opções consecutivas com o mesmo grupo ficam sob um único título. */
  grupo?: string;
};

type SelectProps = {
  value?: string;
  onValueChange?: (v: string) => void;
  opcoes: Opcao[];
  placeholder?: string;
  disabled?: boolean;
  "aria-label"?: string;
};

function agrupar(opcoes: Opcao[]): { grupo: string | undefined; itens: Opcao[] }[] {
  const blocos: { grupo: string | undefined; itens: Opcao[] }[] = [];
  for (const o of opcoes) {
    const ultimo = blocos[blocos.length - 1];
    if (ultimo && ultimo.grupo === o.grupo && o.grupo !== undefined) ultimo.itens.push(o);
    else blocos.push({ grupo: o.grupo, itens: [o] });
  }
  return blocos;
}

function Item({ o }: { o: Opcao }) {
  return (
    <RSelect.Item
      value={o.value}
      disabled={o.disabled}
      className="relative flex h-9 cursor-default select-none items-center rounded-[6px] px-3 text-sm outline-none data-[disabled]:opacity-40 data-[highlighted]:bg-v2-nevoa/10 data-[state=checked]:text-v2-azul-luz"
    >
      <RSelect.ItemText>{o.label}</RSelect.ItemText>
    </RSelect.Item>
  );
}

export function Select({ value, onValueChange, opcoes, placeholder, disabled, ...aria }: SelectProps) {
  const container = usePortalContainer();
  return (
    <RSelect.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <RSelect.Trigger
        {...aria}
        className={cx(
          "inline-flex h-10 min-w-40 items-center justify-between gap-3 rounded-v2-sm bg-v2-casco-alto px-3 text-sm text-v2-nevoa shadow-v2-1",
          "ring-1 ring-inset ring-v2-azul-luz/15 disabled:pointer-events-none disabled:opacity-40",
          foco,
        )}
      >
        <RSelect.Value placeholder={placeholder} />
        <RSelect.Icon aria-hidden>▾</RSelect.Icon>
      </RSelect.Trigger>
      <RSelect.Portal container={container}>
        <RSelect.Content
          position="popper"
          sideOffset={6}
          className="v2-pop v2-vidro z-50 min-w-(--radix-select-trigger-width) rounded-v2-sm p-1 text-v2-nevoa"
        >
          <RSelect.Viewport>
            {agrupar(opcoes).map((bloco) =>
              bloco.grupo === undefined ? (
                bloco.itens.map((o) => <Item key={o.value} o={o} />)
              ) : (
                <RSelect.Group key={`g-${bloco.grupo}-${bloco.itens[0].value}`}>
                  <RSelect.Label className="px-3 pb-1 pt-2 text-xs font-medium text-v2-nevoa/55">{bloco.grupo}</RSelect.Label>
                  {bloco.itens.map((o) => (
                    <Item key={o.value} o={o} />
                  ))}
                </RSelect.Group>
              ),
            )}
          </RSelect.Viewport>
        </RSelect.Content>
      </RSelect.Portal>
    </RSelect.Root>
  );
}
