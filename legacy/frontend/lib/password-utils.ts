/**
 * Password strength validation utilities for TuneTrees
 * Provides real-time password strength calculation and requirement checking
 */

export interface IPasswordRequirement {
  id: string;
  label: string;
  test: (password: string) => boolean;
  description: string;
}

export interface IPasswordStrength {
  score: number; // 0-5 (number of requirements met)
  level: "weak" | "medium" | "strong";
  requirements: Array<IPasswordRequirement & { met: boolean }>;
  percentage: number; // 0-100 for progress bar
}

/**
 * Password requirements following security best practices
 */
export const PASSWORD_REQUIREMENTS: IPasswordRequirement[] = [
  {
    id: "minLength",
    label: "At least 8 characters",
    description: "Password must be at least 8 characters long",
    test: (password: string) => password.length >= 8,
  },
  {
    id: "uppercase",
    label: "One uppercase letter",
    description: "Password must contain at least one uppercase letter",
    test: (password: string) => /[A-Z]/.test(password),
  },
  {
    id: "lowercase",
    label: "One lowercase letter",
    description: "Password must contain at least one lowercase letter",
    test: (password: string) => /[a-z]/.test(password),
  },
  {
    id: "number",
    label: "One number",
    description: "Password must contain at least one number",
    test: (password: string) => /\d/.test(password),
  },
  {
    id: "special",
    label: "One special character",
    description:
      "Password must contain at least one special character (!@#$%^&*)",
    test: (password: string) =>
      /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password),
  },
];

/**
 * Calculate password strength based on requirements
 */
export function calculatePasswordStrength(password: string): IPasswordStrength {
  const requirements = PASSWORD_REQUIREMENTS.map((req) => ({
    ...req,
    met: req.test(password),
  }));

  const score = requirements.filter((req) => req.met).length;
  const percentage = Math.round((score / PASSWORD_REQUIREMENTS.length) * 100);

  let level: "weak" | "medium" | "strong";
  if (score <= 2) {
    level = "weak";
  } else if (score <= 4) {
    level = "medium";
  } else {
    level = "strong";
  }

  return {
    score,
    level,
    requirements,
    percentage,
  };
}

/**
 * Get color class for strength level (following TuneTrees design patterns)
 */
export function getStrengthColor(level: "weak" | "medium" | "strong"): string {
  switch (level) {
    case "weak":
      return "text-red-500";
    case "medium":
      return "text-yellow-500";
    case "strong":
      return "text-green-500";
    default:
      return "text-gray-400";
  }
}

/**
 * Get background color for progress bar
 */
export function getStrengthProgressColor(
  level: "weak" | "medium" | "strong",
): string {
  switch (level) {
    case "weak":
      return "bg-red-500";
    case "medium":
      return "bg-yellow-500";
    case "strong":
      return "bg-green-500";
    default:
      return "bg-gray-300";
  }
}

/**
 * Check if password meets minimum security requirements for form validation
 */
export function isPasswordValid(password: string): boolean {
  const strength = calculatePasswordStrength(password);
  // Require at least "medium" strength (3+ requirements)
  return strength.score >= 3;
}
