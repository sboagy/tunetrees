import type { PolymorphicProps } from "@kobalte/core/polymorphic";
import {
  Popover,
  type PopoverContentProps as PopoverPrimitiveContentProps,
} from "@kobalte/core/popover";
import type { ParentProps, ValidComponent } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "@/lib/utils";

export { Popover };
export const PopoverTrigger = Popover.Trigger;

type PopoverContentProps<T extends ValidComponent = "div"> = ParentProps<
  PopoverPrimitiveContentProps<T> & { class?: string }
>;

export const PopoverContent = <T extends ValidComponent = "div">(
  props: PolymorphicProps<T, PopoverContentProps<T>>
) => {
  const [local, rest] = splitProps(props as PopoverContentProps, ["class"]);

  return (
    <Popover.Portal>
      <Popover.Content
        class={cn(
          "z-50 max-w-xs rounded-md border border-gray-200 bg-white p-3 text-xs text-gray-700 shadow-md outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200",
          local.class
        )}
        {...rest}
      />
    </Popover.Portal>
  );
};
