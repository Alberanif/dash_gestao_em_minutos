"use client";

import * as RTabs from "@radix-ui/react-tabs";
import { cx, foco } from "./cx";

export const Tabs = RTabs.Root;
export const TabsContent = RTabs.Content;

export function TabsList({ className, ...rest }: React.ComponentPropsWithoutRef<typeof RTabs.List>) {
  return (
    <RTabs.List
      className={cx("inline-flex gap-1 rounded-v2-sm bg-v2-casco p-1 ring-1 ring-inset ring-v2-azul-luz/15", className)}
      {...rest}
    />
  );
}

export function TabsTrigger({ className, ...rest }: React.ComponentPropsWithoutRef<typeof RTabs.Trigger>) {
  return (
    <RTabs.Trigger
      className={cx(
        "h-8 rounded-[6px] px-3 text-sm text-v2-nevoa/70 disabled:pointer-events-none disabled:opacity-40",
        "data-[state=active]:bg-v2-casco-alto data-[state=active]:text-v2-nevoa data-[state=active]:shadow-v2-1",
        foco,
        className,
      )}
      {...rest}
    />
  );
}
