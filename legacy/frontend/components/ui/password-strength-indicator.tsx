"use client";

import { CheckCircle, Circle } from "lucide-react";
import { useMemo } from "react";
import {
  calculatePasswordStrength,
  type IPasswordStrength,
} from "@/lib/password-utils";
import { cn } from "@/lib/utils";

interface IPasswordStrengthIndicatorProps {
  password: string;
  className?: string;
  showRequirements?: boolean;
}

/**
 * Real-time password strength indicator component
 * Displays strength level, progress bar, and requirement checklist
 */
export function PasswordStrengthIndicator({
  password,
  className,
  showRequirements = true,
}: IPasswordStrengthIndicatorProps) {
  const strength: IPasswordStrength = useMemo(
    () => calculatePasswordStrength(password),
    [password],
  );

  return (
    <div
      className={cn("space-y-2", className)}
      data-testid="password-strength-indicator"
    >
      {/* Strength Level Hidden */}

      {/* Requirements Checklist */}
      {showRequirements && (
        <div className="space-y-1" data-testid="password-requirements">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1">
            {strength.requirements.map((requirement) => (
              <div
                key={requirement.id}
                className="flex items-center space-x-1.5 text-sm"
                data-testid={`password-requirement-${requirement.id}`}
              >
                {requirement.met ? (
                  <CheckCircle
                    className="h-3 w-3 text-green-500 flex-shrink-0"
                    aria-hidden="true"
                  />
                ) : (
                  <Circle
                    className="h-3 w-3 text-gray-400 flex-shrink-0"
                    aria-hidden="true"
                  />
                )}
                <span
                  className={cn(
                    "text-xs leading-tight",
                    requirement.met
                      ? "text-green-600 dark:text-green-400"
                      : "text-gray-600 dark:text-gray-400",
                  )}
                >
                  {requirement.label}
                </span>
                <span className="sr-only">
                  {requirement.met ? "Met" : "Not met"}:{" "}
                  {requirement.description}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Screen reader summary */}
      <div className="sr-only" aria-live="polite">
        Password strength is {strength.level}. {strength.score} out of{" "}
        {strength.requirements.length} requirements met.
      </div>
    </div>
  );
}

/**
 * Compact version showing only progress bar and strength level
 */
export function PasswordStrengthIndicatorCompact({
  password,
  className,
}: Pick<IPasswordStrengthIndicatorProps, "password" | "className">) {
  return (
    <PasswordStrengthIndicator
      password={password}
      className={className}
      showRequirements={false}
    />
  );
}
