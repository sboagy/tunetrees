/**
 * Tooltip Component
 *
 * Accessible tooltip using @kobalte/core/tooltip, styled with Tailwind.
 *
 * @module components/ui/tooltip
 */

import type { PolymorphicProps } from "@kobalte/core/polymorphic";
import {
  Tooltip as TooltipPrimitive,
  type TooltipContentProps as TooltipPrimitiveContentProps,
} from "@kobalte/core/tooltip";
import type { ParentProps, ValidComponent } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "@/lib/utils";

export const Tooltip = TooltipPrimitive;
export const TooltipTrigger = TooltipPrimitive.Trigger;

type TooltipContentProps<T extends ValidComponent = "div"> = ParentProps<
  TooltipPrimitiveContentProps<T> & { class?: string }
>;

export const TooltipContent = <T extends ValidComponent = "div">(
  props: PolymorphicProps<T, TooltipContentProps<T>>
) => {
  const [local, rest] = splitProps(props as TooltipContentProps, ["class"]);

  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        class={cn(
          "z-50 rounded-md border border-border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md",
          "animate-in fade-in-0 zoom-in-95",
          "data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[closed]:zoom-out-95",
          local.class
        )}
        {...rest}
      />
    </TooltipPrimitive.Portal>
  );
};
