import type { PolymorphicProps } from "@kobalte/core/polymorphic";
import type {
  SwitchControlProps,
  SwitchThumbProps,
} from "@kobalte/core/switch";
import { Switch as SwitchPrimitive } from "@kobalte/core/switch";
import type { ParentProps, ValidComponent, VoidProps } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "@/lib/utils";

export const SwitchLabel = SwitchPrimitive.Label;
export const Switch = SwitchPrimitive;
export const SwitchErrorMessage = SwitchPrimitive.ErrorMessage;
export const SwitchDescription = SwitchPrimitive.Description;

type switchControlProps<T extends ValidComponent = "input"> = ParentProps<
  SwitchControlProps<T> & { class?: string }
>;

export const SwitchControl = <T extends ValidComponent = "input">(
  props: PolymorphicProps<T, switchControlProps<T>>,
) => {
  const [local, rest] = splitProps(props as switchControlProps, [
    "class",
    "children",
  ]);

  return (
    <>
      <SwitchPrimitive.Input class="[&:focus-visible+div]:outline-none [&:focus-visible+div]:ring-[1.5px] [&:focus-visible+div]:ring-ring [&:focus-visible+div]:ring-offset-2 [&:focus-visible+div]:ring-offset-background" />
      <SwitchPrimitive.Control
        class={cn(
          "inline-flex h-4 w-7 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent bg-gray-300 dark:bg-gray-600 shadow-sm transition-[color,background-color,box-shadow] data-[disabled]:cursor-not-allowed data-[checked]:bg-blue-600 dark:data-[checked]:bg-blue-500 data-[disabled]:opacity-50",
          local.class,
        )}
        {...rest}
      >
        {local.children}
      </SwitchPrimitive.Control>
    </>
  );
};

type switchThumbProps<T extends ValidComponent = "div"> = VoidProps<
  SwitchThumbProps<T> & { class?: string }
>;

export const SwitchThumb = <T extends ValidComponent = "div">(
  props: PolymorphicProps<T, switchThumbProps<T>>,
) => {
  const [local, rest] = splitProps(props as switchThumbProps, ["class"]);

  return (
    <SwitchPrimitive.Thumb
      class={cn(
        "pointer-events-none block h-3 w-3 translate-x-0 rounded-full bg-white dark:bg-gray-100 shadow-lg ring-0 transition-transform data-[checked]:translate-x-3",
        local.class,
      )}
      {...rest}
    />
  );
};
