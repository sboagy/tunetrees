/**
 * Alert Dialog Component
 *
 * Based on Kobalte's dialog primitive with shadcn-solid styling.
 * Used for important confirmations and alerts.
 *
 * @module components/ui/alert-dialog
 */

import type {
  DialogContentProps,
  DialogDescriptionProps,
  DialogTitleProps,
  DialogTriggerProps,
} from "@kobalte/core/dialog";
import { Dialog as DialogPrimitive } from "@kobalte/core/dialog";
import type { PolymorphicProps } from "@kobalte/core/polymorphic";
import type { ParentProps, ValidComponent, VoidProps } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "@/lib/utils";

export const AlertDialogTrigger = DialogPrimitive.Trigger;

export const AlertDialog = DialogPrimitive;

type AlertDialogContentPropsWithClass<T extends ValidComponent = "div"> =
  ParentProps<DialogContentProps<T> & { class?: string }>;

export const AlertDialogContent = <T extends ValidComponent = "div">(
  props: PolymorphicProps<T, AlertDialogContentPropsWithClass<T>>
) => {
  const [local, rest] = splitProps(props as AlertDialogContentPropsWithClass, [
    "class",
    "children",
  ]);

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay class="fixed inset-0 z-40 bg-black/50 data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0" />
      <DialogPrimitive.Content
        class={cn(
          "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-[hsl(var(--background))] p-6 shadow-lg duration-200 data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0 data-[closed]:zoom-out-95 data-[expanded]:zoom-in-95 data-[closed]:slide-out-to-left-1/2 data-[closed]:slide-out-to-top-[48%] data-[expanded]:slide-in-from-left-1/2 data-[expanded]:slide-in-from-top-[48%] rounded-lg md:w-full",
          local.class
        )}
        {...rest}
      >
        {local.children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
};

type AlertDialogHeaderProps = ParentProps<{ class?: string }>;

export const AlertDialogHeader = (props: AlertDialogHeaderProps) => {
  const [local, rest] = splitProps(props, ["class", "children"]);

  return (
    <div
      class={cn(
        "flex flex-col space-y-2 text-center sm:text-left",
        local.class
      )}
      {...rest}
    >
      {local.children}
    </div>
  );
};

type AlertDialogFooterProps = ParentProps<{ class?: string }>;

export const AlertDialogFooter = (props: AlertDialogFooterProps) => {
  const [local, rest] = splitProps(props, ["class", "children"]);

  return (
    <div
      class={cn(
        "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
        local.class
      )}
      {...rest}
    >
      {local.children}
    </div>
  );
};

type AlertDialogTitlePropsWithClass<T extends ValidComponent = "h2"> =
  ParentProps<DialogTitleProps<T> & { class?: string }>;

export const AlertDialogTitle = <T extends ValidComponent = "h2">(
  props: PolymorphicProps<T, AlertDialogTitlePropsWithClass<T>>
) => {
  const [local, rest] = splitProps(props as AlertDialogTitlePropsWithClass, [
    "class",
    "children",
  ]);

  return (
    <DialogPrimitive.Title
      class={cn("text-lg font-semibold", local.class)}
      {...rest}
    >
      {local.children}
    </DialogPrimitive.Title>
  );
};

type AlertDialogDescriptionPropsWithClass<T extends ValidComponent = "p"> =
  ParentProps<DialogDescriptionProps<T> & { class?: string }>;

export const AlertDialogDescription = <T extends ValidComponent = "p">(
  props: PolymorphicProps<T, AlertDialogDescriptionPropsWithClass<T>>
) => {
  const [local, rest] = splitProps(
    props as AlertDialogDescriptionPropsWithClass,
    ["class", "children"]
  );

  return (
    <DialogPrimitive.Description
      class={cn("text-sm text-muted-foreground", local.class)}
      {...rest}
    >
      {local.children}
    </DialogPrimitive.Description>
  );
};

type AlertDialogCloseButtonProps<T extends ValidComponent = "button"> =
  VoidProps<DialogTriggerProps<T> & { class?: string }>;

export const AlertDialogCloseButton = <T extends ValidComponent = "button">(
  props: PolymorphicProps<T, AlertDialogCloseButtonProps<T>>
) => {
  const [local, rest] = splitProps(props as AlertDialogCloseButtonProps, [
    "class",
  ]);

  return (
    <DialogPrimitive.CloseButton
      class={cn(
        "absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-[1.5px] focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[expanded]:bg-accent data-[expanded]:text-muted-foreground",
        local.class
      )}
      {...rest}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="h-4 w-4"
      >
        <title>Close</title>
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
      </svg>
      <span class="sr-only">Close</span>
    </DialogPrimitive.CloseButton>
  );
};
