"use client";

import * as RTooltip from "@radix-ui/react-tooltip";
import { usePortalContainer } from "./v2-root";

type TooltipProps = {
  conteudo: React.ReactNode;
  children: React.ReactElement;
  delayDuration?: number;
};

/** O filho precisa aceitar ref e props de elemento (botão, link ou similar). */
export function Tooltip({ conteudo, children, delayDuration = 200 }: TooltipProps) {
  const container = usePortalContainer();
  return (
    <RTooltip.Provider delayDuration={delayDuration}>
      <RTooltip.Root>
        <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
        <RTooltip.Portal container={container}>
          <RTooltip.Content
            sideOffset={6}
            className="v2-pop z-50 max-w-64 rounded-v2-sm bg-v2-casco-alto px-3 py-1.5 text-xs text-v2-nevoa shadow-v2-2 ring-1 ring-inset ring-v2-azul-luz/20"
          >
            {conteudo}
          </RTooltip.Content>
        </RTooltip.Portal>
      </RTooltip.Root>
    </RTooltip.Provider>
  );
}
