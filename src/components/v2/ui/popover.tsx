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
          "v2-pop v2-vidro z-50 w-72 rounded-v2-md p-4 text-v2-nevoa outline-none",
          className,
        )}
        {...rest}
      />
    </RPopover.Portal>
  );
}
