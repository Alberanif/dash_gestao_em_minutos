"use client";

import * as RPopover from "@radix-ui/react-popover";
import { usePortalContainer } from "./v2-root";
import { cx } from "./cx";

export const Popover = RPopover.Root;
export const PopoverTrigger = RPopover.Trigger;

export function PopoverContent({
  className,
  sideOffset = 8,
  ...rest
}: React.ComponentPropsWithoutRef<typeof RPopover.Content>) {
  const container = usePortalContainer();
  return (
    <RPopover.Portal container={container}>
      <RPopover.Content
        sideOffset={sideOffset}
        className={cx(
          "v2-pop z-50 w-72 rounded-v2-md bg-v2-casco-alto p-4 text-v2-nevoa shadow-v2-2 ring-1 ring-inset ring-v2-azul-luz/20 outline-none",
          className,
        )}
        {...rest}
      />
    </RPopover.Portal>
  );
}
