/**
 * Checkbox Component
 *
 * Based on Kobalte's checkbox primitive with shadcn-solid styling.
 *
 * @module components/ui/checkbox
 */

import type {
  CheckboxControlProps,
  CheckboxIndicatorProps,
  CheckboxRootProps,
} from "@kobalte/core/checkbox";
import { Checkbox as CheckboxPrimitive } from "@kobalte/core/checkbox";
import type { PolymorphicProps } from "@kobalte/core/polymorphic";
import { Check } from "lucide-solid";
import type { ParentProps, ValidComponent } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "@/lib/utils";

export const CheckboxLabel = CheckboxPrimitive.Label;
export const CheckboxDescription = CheckboxPrimitive.Description;
export const CheckboxErrorMessage = CheckboxPrimitive.ErrorMessage;

type CheckboxRootPropsWithClass<T extends ValidComponent = "div"> =
  CheckboxRootProps<T> & { class?: string };

export const Checkbox = <T extends ValidComponent = "div">(
  props: PolymorphicProps<T, CheckboxRootPropsWithClass<T>>
) => {
  const [local, rest] = splitProps(props as CheckboxRootPropsWithClass, [
    "class",
  ]);

  return (
    <CheckboxPrimitive
      class={cn("items-top flex space-x-2", local.class)}
      {...rest}
    />
  );
};

type CheckboxControlPropsWithClass<T extends ValidComponent = "div"> =
  ParentProps<CheckboxControlProps<T> & { class?: string }>;

export const CheckboxControl = <T extends ValidComponent = "div">(
  props: PolymorphicProps<T, CheckboxControlPropsWithClass<T>>
) => {
  const [local, rest] = splitProps(props as CheckboxControlPropsWithClass, [
    "class",
  ]);

  return (
    <>
      <CheckboxPrimitive.Input />
      <CheckboxPrimitive.Control
        class={cn(
          "peer h-4 w-4 shrink-0 rounded-sm border border-primary shadow focus-visible:outline-none focus-visible:ring-[1.5px] focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[checked]:bg-primary data-[checked]:text-primary-foreground",
          local.class
        )}
        {...rest}
      />
    </>
  );
};

type CheckboxIndicatorPropsWithClass<T extends ValidComponent = "div"> =
  ParentProps<CheckboxIndicatorProps<T> & { class?: string }>;

export const CheckboxIndicator = <T extends ValidComponent = "div">(
  props: PolymorphicProps<T, CheckboxIndicatorPropsWithClass<T>>
) => {
  const [local, rest] = splitProps(props as CheckboxIndicatorPropsWithClass, [
    "class",
  ]);

  return (
    <CheckboxPrimitive.Indicator
      class={cn("flex items-center justify-center text-current", local.class)}
      {...rest}
    >
      <Check class="h-4 w-4" aria-hidden="true" />
    </CheckboxPrimitive.Indicator>
  );
};
