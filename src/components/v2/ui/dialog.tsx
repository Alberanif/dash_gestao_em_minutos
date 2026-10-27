"use client";

import * as RDialog from "@radix-ui/react-dialog";
import { usePortalContainer } from "./v2-root";
import { cx } from "./cx";

export const Dialog = RDialog.Root;
export const DialogTrigger = RDialog.Trigger;
export const DialogClose = RDialog.Close;
export const DialogTitle = RDialog.Title;
export const DialogDescription = RDialog.Description;

export function DialogContent({
  className,
  children,
  ...rest
}: React.ComponentPropsWithoutRef<typeof RDialog.Content>) {
  const container = usePortalContainer();
  return (
    <RDialog.Portal container={container}>
      <RDialog.Overlay className="v2-fade fixed inset-0 z-50 bg-v2-abismo/80" />
      <RDialog.Content
        className={cx(
          "v2-pop fixed left-1/2 top-1/2 z-50 w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2",
          "v2-vidro rounded-v2-lg p-6 text-v2-nevoa outline-none",
          className,
        )}
        {...rest}
      >
        {children}
      </RDialog.Content>
    </RDialog.Portal>
  );
}
