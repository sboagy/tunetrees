"use client";

import { useEffect, useState } from "react";
import { CheckCircle, Circle, Shield } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import {
  type IPasswordStrengthResult,
  validatePasswordStrength,
  getStrengthLabel,
  getStrengthColor,
} from "@/lib/password-validation";

interface IPasswordStrengthValidatorProps {
  password: string;
  onStrengthChange?: (result: IPasswordStrengthResult) => void;
  className?: string;
}

/**
 * Password Strength Validator Component
 * Provides real-time password strength visualization following TuneTrees UI patterns
 */
export function PasswordStrengthValidator({
  password,
  onStrengthChange,
  className = "",
}: IPasswordStrengthValidatorProps) {
  const [strengthResult, setStrengthResult] = useState<IPasswordStrengthResult>(
    {
      score: 0,
      isValid: false,
      requirements: [],
      feedback: [],
    },
  );

  // Real-time validation on password change
  useEffect(() => {
    const result = validatePasswordStrength(password);
    setStrengthResult(result);
    onStrengthChange?.(result);
  }, [password, onStrengthChange]);

  // Don't show anything if password is empty
  if (!password) {
    return null;
  }

  const strengthLabel = getStrengthLabel(strengthResult.score);
  const progressValue = (strengthResult.score / 4) * 100;

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Strength Indicator with Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Shield className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Password Strength:
            </span>
            <span
              className={`text-sm font-semibold ${
                strengthResult.score >= 3
                  ? "text-green-600 dark:text-green-400"
                  : strengthResult.score >= 2
                    ? "text-yellow-600 dark:text-yellow-400"
                    : "text-red-600 dark:text-red-400"
              }`}
            >
              {strengthLabel}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="relative">
          <Progress
            value={progressValue}
            className="h-2 bg-gray-200 dark:bg-gray-700"
          />
          <div
            className={`absolute top-0 left-0 h-2 rounded-full transition-all duration-300 ${getStrengthColor(
              strengthResult.score,
            )}`}
            style={{ width: `${progressValue}%` }}
          />
        </div>
      </div>

      {/* Requirements Checklist */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Requirements:
        </h4>
        <div className="space-y-1">
          {strengthResult.requirements.map((requirement) => (
            <div
              key={requirement.id}
              className="flex items-center space-x-2 text-sm"
            >
              {requirement.met ? (
                <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
              ) : (
                <Circle className="h-4 w-4 text-gray-400 flex-shrink-0" />
              )}
              <span
                className={
                  requirement.met
                    ? "text-green-600 dark:text-green-400"
                    : "text-gray-600 dark:text-gray-400"
                }
              >
                {requirement.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Feedback Messages */}
      {strengthResult.feedback.length > 0 && (
        <div className="space-y-1">
          {strengthResult.feedback.map((message, index) => (
            <p
              key={index}
              className={`text-xs ${
                strengthResult.score >= 3
                  ? "text-green-600 dark:text-green-400"
                  : strengthResult.score >= 2
                    ? "text-yellow-600 dark:text-yellow-400"
                    : "text-red-600 dark:text-red-400"
              }`}
            >
              {message}
            </p>
          ))}
        </div>
      )}

      {/* Validation Status for Form Integration */}
      {!strengthResult.isValid && password.length > 0 && (
        <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded border-l-4 border-red-500">
          Password does not meet security requirements
        </div>
      )}

      {strengthResult.isValid && (
        <div className="text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 p-2 rounded border-l-4 border-green-500">
          Password meets all security requirements ✓
        </div>
      )}
    </div>
  );
}

export default PasswordStrengthValidator;
