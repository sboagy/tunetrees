/**
 * Card Component
 *
 * Simple card component for grouping content
 */

import { type ComponentProps, splitProps } from "solid-js";
import { cn } from "@/lib/utils";

export function Card(props: Readonly<ComponentProps<"div">>) {
  const [local, others] = splitProps(props, ["class", "classList"]);
  return (
    <div
      class={cn(
        "rounded-lg border border-border bg-card text-card-foreground shadow-sm",
        local.class
      )}
      classList={local.classList}
      {...others}
    />
  );
}

export function CardHeader(props: Readonly<ComponentProps<"div">>) {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <div class={cn("flex flex-col space-y-1.5 p-6", local.class)} {...others} />
  );
}

export function CardTitle(props: Readonly<ComponentProps<"h3">>) {
  const [local, others] = splitProps(props, ["class", "children"]);
  return (
    <h3
      class={cn(
        "text-2xl font-semibold leading-none tracking-tight",
        local.class
      )}
      {...others}
    >
      {local.children}
    </h3>
  );
}

export function CardDescription(props: Readonly<ComponentProps<"p">>) {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <p class={cn("text-sm text-muted-foreground", local.class)} {...others} />
  );
}

export function CardContent(props: Readonly<ComponentProps<"div">>) {
  const [local, others] = splitProps(props, ["class"]);
  return <div class={cn("p-6 pt-0", local.class)} {...others} />;
}

export function CardFooter(props: Readonly<ComponentProps<"div">>) {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <div class={cn("flex items-center p-6 pt-0", local.class)} {...others} />
  );
}
