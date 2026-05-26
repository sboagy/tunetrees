import type {
  ComboboxContentProps,
  ComboboxInputProps,
  ComboboxItemProps,
  ComboboxTriggerProps,
} from "@kobalte/core/combobox";
import { Combobox } from "@kobalte/core/combobox";
import type { PolymorphicProps } from "@kobalte/core/polymorphic";
import { Check, ChevronsUpDown } from "lucide-solid";
import type { ParentProps, ValidComponent, VoidProps } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "@/lib/utils";

export { Combobox };
export const ComboboxDescription = Combobox.Description;
export const ComboboxErrorMessage = Combobox.ErrorMessage;
export const ComboboxItemDescription = Combobox.ItemDescription;
export const ComboboxHiddenSelect = Combobox.HiddenSelect;

type comboboxInputProps<T extends ValidComponent = "input"> = VoidProps<
  ComboboxInputProps<T> & {
    class?: string;
  }
>;

export const ComboboxInput = <T extends ValidComponent = "input">(
  props: PolymorphicProps<T, comboboxInputProps<T>>
) => {
  const [local, rest] = splitProps(props as comboboxInputProps, ["class"]);

  return (
    <Combobox.Input
      class={cn(
        "h-full bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        local.class
      )}
      {...rest}
    />
  );
};

type comboboxTriggerProps<T extends ValidComponent = "button"> = ParentProps<
  ComboboxTriggerProps<T> & {
    class?: string;
  }
>;

export const ComboboxTrigger = <T extends ValidComponent = "button">(
  props: PolymorphicProps<T, comboboxTriggerProps<T>>
) => {
  const [local, rest] = splitProps(props as comboboxTriggerProps, [
    "class",
    "children",
  ]);

  return (
    <Combobox.Control>
      <Combobox.Trigger
        class={cn(
          "flex h-9 w-full items-center justify-between rounded-md border border-input px-3 shadow-sm",
          local.class
        )}
        {...rest}
      >
        {local.children}
        <Combobox.Icon
          aria-hidden="true"
          class="flex h-3.5 w-3.5 items-center justify-center"
        >
          <ChevronsUpDown class="h-4 w-4 opacity-50" aria-hidden="true" />
        </Combobox.Icon>
      </Combobox.Trigger>
    </Combobox.Control>
  );
};

type comboboxContentProps<T extends ValidComponent = "div"> =
  ComboboxContentProps<T> & {
    class?: string;
  };

export const ComboboxContent = <T extends ValidComponent = "div">(
  props: PolymorphicProps<T, comboboxContentProps<T>>
) => {
  const [local, rest] = splitProps(props as comboboxContentProps, ["class"]);

  return (
    <Combobox.Portal>
      <Combobox.Content
        class={cn(
          "relative z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0 data-[closed]:zoom-out-95 data-[expanded]:zoom-in-95 origin-[--kb-combobox-content-transform-origin]",
          local.class
        )}
        {...rest}
      >
        <Combobox.Listbox class="p-1" />
      </Combobox.Content>
    </Combobox.Portal>
  );
};

type comboboxItemProps<T extends ValidComponent = "li"> = ParentProps<
  ComboboxItemProps<T> & {
    class?: string;
  }
>;

export const ComboboxItem = <T extends ValidComponent = "li">(
  props: PolymorphicProps<T, comboboxItemProps<T>>
) => {
  const [local, rest] = splitProps(props as comboboxItemProps, [
    "class",
    "children",
  ]);

  return (
    <Combobox.Item
      class={cn(
        "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none data-[disabled]:pointer-events-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:opacity-50",
        local.class
      )}
      {...rest}
    >
      <Combobox.ItemIndicator
        aria-hidden="true"
        class="absolute right-2 flex h-3.5 w-3.5 items-center justify-center"
      >
        <Check class="h-4 w-4" aria-hidden="true" />
      </Combobox.ItemIndicator>
      <Combobox.ItemLabel>{local.children}</Combobox.ItemLabel>
    </Combobox.Item>
  );
};
