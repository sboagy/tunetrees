"use client";

import { cn } from "@/lib/utils";
import {
  calculatePasswordStrength,
  getStrengthColor,
  getStrengthProgressColor,
  type IPasswordStrength,
} from "@/lib/password-utils";
import { CheckCircle, Circle } from "lucide-react";
import { useMemo } from "react";

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

  // Don't show anything if password is empty
  if (!password) {
    return null;
  }

  const strengthColor = getStrengthColor(strength.level);
  const progressColor = getStrengthProgressColor(strength.level);

  return (
    <div
      className={cn("space-y-3", className)}
      data-testid="password-strength-indicator"
    >
      {/* Strength Level and Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Password Strength
          </span>
          <span
            className={cn("text-sm font-medium capitalize", strengthColor)}
            data-testid="password-strength-level"
          >
            {strength.level}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className={cn(
              "h-full transition-all duration-300 ease-in-out",
              progressColor,
            )}
            style={{ width: `${strength.percentage}%` }}
            role="progressbar"
            aria-valuenow={strength.percentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Password strength: ${strength.level}, ${strength.percentage}% complete`}
          />
        </div>
      </div>

      {/* Requirements Checklist */}
      {showRequirements && (
        <div className="space-y-1" data-testid="password-requirements">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Requirements:
          </span>
          <ul className="space-y-1" role="list">
            {strength.requirements.map((requirement) => (
              <li
                key={requirement.id}
                className="flex items-center space-x-2 text-sm"
                data-testid={`password-requirement-${requirement.id}`}
              >
                {requirement.met ? (
                  <CheckCircle
                    className="h-4 w-4 text-green-500"
                    aria-hidden="true"
                  />
                ) : (
                  <Circle
                    className="h-4 w-4 text-gray-400"
                    aria-hidden="true"
                  />
                )}
                <span
                  className={cn(
                    "text-sm",
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
              </li>
            ))}
          </ul>
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
