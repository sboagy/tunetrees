/**
 * Select Component
 *
 * Based on Kobalte's select primitive with shadcn-solid styling.
 *
 * @module components/ui/select
 */

import { cn } from "@/lib/utils";
import type { PolymorphicProps } from "@kobalte/core/polymorphic";
import type {
	SelectContentProps,
	SelectItemProps,
	SelectRootProps,
	SelectTriggerProps,
} from "@kobalte/core/select";
import { Select as SelectPrimitive } from "@kobalte/core/select";
import type { ParentProps, ValidComponent, VoidProps } from "solid-js";
import { splitProps } from "solid-js";

export const SelectValue = SelectPrimitive.Value;
export const SelectDescription = SelectPrimitive.Description;
export const SelectErrorMessage = SelectPrimitive.ErrorMessage;
export const SelectItemLabel = SelectPrimitive.ItemLabel;
export const SelectItemDescription = SelectPrimitive.ItemDescription;
export const SelectItemIndicator = SelectPrimitive.ItemIndicator;
export const SelectHiddenSelect = SelectPrimitive.HiddenSelect;

type SelectRootPropsWithClass<T> = SelectRootProps<T> & { class?: string };

export const Select = <T extends ValidComponent = "div", Option = unknown>(
	props: PolymorphicProps<T, SelectRootPropsWithClass<Option>>,
) => {
	const [local, rest] = splitProps(props as SelectRootPropsWithClass<Option>, [
		"class",
	]);

	return <SelectPrimitive class={cn("w-full", local.class)} {...rest} />;
};

type SelectTriggerPropsWithClass<T extends ValidComponent = "button"> =
	ParentProps<SelectTriggerProps<T> & { class?: string }>;

export const SelectTrigger = <T extends ValidComponent = "button">(
	props: PolymorphicProps<T, SelectTriggerPropsWithClass<T>>,
) => {
	const [local, rest] = splitProps(props as SelectTriggerPropsWithClass, [
		"class",
		"children",
	]);

	return (
		<SelectPrimitive.Trigger
			class={cn(
				"flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-[1.5px] focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
				local.class,
			)}
			{...rest}
		>
			{local.children}
			<SelectPrimitive.Icon class="flex h-4 w-4 items-center justify-center">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="h-4 w-4 opacity-50"
				>
					<title>Chevron Down</title>
					<path d="m6 9 6 6 6-6" />
				</svg>
			</SelectPrimitive.Icon>
		</SelectPrimitive.Trigger>
	);
};

type SelectContentPropsWithClass<T extends ValidComponent = "div"> =
	ParentProps<SelectContentProps<T> & { class?: string }>;

export const SelectContent = <T extends ValidComponent = "div">(
	props: PolymorphicProps<T, SelectContentPropsWithClass<T>>,
) => {
	const [local, rest] = splitProps(props as SelectContentPropsWithClass, [
		"class",
		"children",
	]);

	return (
		<SelectPrimitive.Portal>
			<SelectPrimitive.Content
				class={cn(
					"relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0 data-[closed]:zoom-out-95 data-[expanded]:zoom-in-95",
					local.class,
				)}
				{...rest}
			>
				<SelectPrimitive.Listbox class="p-1" />
			</SelectPrimitive.Content>
		</SelectPrimitive.Portal>
	);
};

type SelectItemPropsWithClass<T extends ValidComponent = "li"> = ParentProps<
	SelectItemProps<T> & { class?: string }
>;

export const SelectItem = <T extends ValidComponent = "li">(
	props: PolymorphicProps<T, SelectItemPropsWithClass<T>>,
) => {
	const [local, rest] = splitProps(props as SelectItemPropsWithClass, [
		"class",
		"children",
	]);

	return (
		<SelectPrimitive.Item
			class={cn(
				"relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
				local.class,
			)}
			{...rest}
		>
			<SelectPrimitive.ItemIndicator class="absolute right-2 flex h-4 w-4 items-center justify-center">
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
					<title>Check</title>
					<polyline points="20 6 9 17 4 12" />
				</svg>
			</SelectPrimitive.ItemIndicator>
			<SelectPrimitive.ItemLabel>{local.children}</SelectPrimitive.ItemLabel>
		</SelectPrimitive.Item>
	);
};
