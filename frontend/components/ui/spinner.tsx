"use client";

import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import * as React from "react";

interface ISpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "default" | "lg";
}

const Spinner = React.forwardRef<HTMLDivElement, ISpinnerProps>(
  ({ className, size = "default", ...props }, ref) => {
    const sizeClasses = {
      sm: "h-4 w-4",
      default: "h-6 w-6",
      lg: "h-8 w-8",
    };

    return (
      <div ref={ref} className={cn("animate-spin", className)} {...props}>
        <Loader2 className={sizeClasses[size]} />
      </div>
    );
  },
);

Spinner.displayName = "Spinner";

export { Spinner };
