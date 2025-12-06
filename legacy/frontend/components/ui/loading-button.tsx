"use client";

import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

interface ILoadingButtonProps extends ButtonProps {
  loading?: boolean;
  spinnerSize?: "sm" | "default" | "lg";
}

const LoadingButton = React.forwardRef<HTMLButtonElement, ILoadingButtonProps>(
  (
    {
      className,
      children,
      loading = false,
      spinnerSize = "sm",
      disabled,
      ...props
    },
    ref,
  ) => {
    return (
      <Button
        className={cn(className)}
        disabled={disabled || loading}
        ref={ref}
        {...props}
      >
        {loading && (
          <Spinner size={spinnerSize} className="mr-2" aria-hidden="true" />
        )}
        {children}
      </Button>
    );
  },
);

LoadingButton.displayName = "LoadingButton";

export { LoadingButton };
