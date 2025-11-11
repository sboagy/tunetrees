/**
 * Table UI Components (Solid + Tailwind port from shadcn/ui)
 */

import type { Component, JSX } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "../../lib/utils";

export const Table: Component<JSX.HTMLAttributes<HTMLTableElement>> = (
  props
) => {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <table
      class={cn("w-full caption-bottom text-sm", local.class)}
      {...others}
    />
  );
};

export const TableHeader: Component<
  JSX.HTMLAttributes<HTMLTableSectionElement>
> = (props) => {
  const [local, others] = splitProps(props, ["class"]);
  return <thead class={cn("[&_tr]:border-b", local.class)} {...others} />;
};

export const TableBody: Component<
  JSX.HTMLAttributes<HTMLTableSectionElement>
> = (props) => {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <tbody class={cn("[&_tr:last-child]:border-0", local.class)} {...others} />
  );
};

export const TableRow: Component<JSX.HTMLAttributes<HTMLTableRowElement>> = (
  props
) => {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <tr
      class={cn(
        "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
        local.class
      )}
      {...others}
    />
  );
};

export const TableHead: Component<
  JSX.ThHTMLAttributes<HTMLTableCellElement>
> = (props) => {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <th
      class={cn(
        "h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0",
        local.class
      )}
      {...others}
    />
  );
};

export const TableCell: Component<
  JSX.TdHTMLAttributes<HTMLTableCellElement>
> = (props) => {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <td
      class={cn("p-4 align-middle [&:has([role=checkbox])]:pr-0", local.class)}
      {...others}
    />
  );
};
