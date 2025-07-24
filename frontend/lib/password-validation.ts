/**
 * Password strength validation logic for TuneTrees authentication
 * Implements comprehensive password security requirements
 */

// TypeScript interfaces following TuneTrees convention (I prefix)
export interface IPasswordStrengthResult {
  score: number; // 0-4 score
  isValid: boolean;
  requirements: IPasswordRequirement[];
  feedback: string[];
}

export interface IPasswordRequirement {
  id: string;
  label: string;
  met: boolean;
  description: string;
}

export interface IPasswordStrengthConfig {
  minLength: number;
  requiredCharacterTypes: number;
  forbiddenPatterns: RegExp[];
  commonPasswords: string[];
}

// Password strength configuration
const defaultConfig: IPasswordStrengthConfig = {
  minLength: 8,
  requiredCharacterTypes: 3, // Must include at least 3 of 4 types
  forbiddenPatterns: [
    /(.)\1{2,}/, // Repeated characters (aaa)
    /123|234|345|456|567|678|789|890/, // Sequential numbers
    /abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|lmn|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz/i, // Sequential letters
    /012|987|876|765|654|543|432|321|210/, // Reverse sequential numbers
  ],
  commonPasswords: [
    "password",
    "password123",
    "123456",
    "123456789",
    "qwerty",
    "abc123",
    "letmein",
    "welcome",
    "admin",
    "login",
    "tunetrees",
    "music",
  ],
};

// Character type detection patterns
const characterPatterns = {
  lowercase: /[a-z]/,
  uppercase: /[A-Z]/,
  numbers: /[0-9]/,
  special: /[!@#$%^&*()_+\-=[\]{}|;:,./<>?]/,
};

/**
 * Evaluates password strength and returns comprehensive feedback
 */
export function validatePasswordStrength(
  password: string,
  config: IPasswordStrengthConfig = defaultConfig,
): IPasswordStrengthResult {
  const requirements = generateRequirements(password, config);
  const score = calculateStrengthScore(password, requirements);
  const feedback = generateFeedback(password, requirements, score);
  const isValid = requirements.every((req) => req.met) && score >= 3;

  return {
    score,
    isValid,
    requirements,
    feedback,
  };
}

/**
 * Generates requirement checklist for UI display
 */
function generateRequirements(
  password: string,
  config: IPasswordStrengthConfig,
): IPasswordRequirement[] {
  const characterTypes = countCharacterTypes(password);

  return [
    {
      id: "length",
      label: `At least ${config.minLength} characters`,
      met: password.length >= config.minLength,
      description: `Password must be at least ${config.minLength} characters long`,
    },
    {
      id: "character-variety",
      label: `At least ${config.requiredCharacterTypes} character types`,
      met: characterTypes >= config.requiredCharacterTypes,
      description: `Include ${config.requiredCharacterTypes} of: lowercase, uppercase, numbers, special characters`,
    },
    {
      id: "no-common",
      label: "Not a common password",
      met: !isCommonPassword(password, config.commonPasswords),
      description: "Avoid commonly used passwords",
    },
    {
      id: "no-patterns",
      label: "No obvious patterns",
      met: !hasForbiddenPatterns(password, config.forbiddenPatterns),
      description: "Avoid repeated characters or sequential patterns",
    },
  ];
}

/**
 * Counts how many character types are present in password
 */
function countCharacterTypes(password: string): number {
  return Object.values(characterPatterns).filter((pattern) =>
    pattern.test(password),
  ).length;
}

/**
 * Checks if password matches common/weak passwords
 */
function isCommonPassword(
  password: string,
  commonPasswords: string[],
): boolean {
  const lowerPassword = password.toLowerCase();
  return commonPasswords.some((common) =>
    lowerPassword.includes(common.toLowerCase()),
  );
}

/**
 * Checks for forbidden patterns (sequential, repeated chars)
 */
function hasForbiddenPatterns(password: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(password));
}

/**
 * Calculates overall strength score (0-4)
 */
function calculateStrengthScore(
  password: string,
  requirements: IPasswordRequirement[],
): number {
  const metRequirements = requirements.filter((req) => req.met).length;
  const totalRequirements = requirements.length;

  // Base score from requirements met
  let score = Math.floor((metRequirements / totalRequirements) * 4);

  // Bonus points for extra length and character variety
  if (password.length >= 12) score = Math.min(4, score + 1);
  if (countCharacterTypes(password) === 4) score = Math.min(4, score + 1);

  return Math.max(0, Math.min(4, score));
}

/**
 * Generates helpful feedback messages
 */
function generateFeedback(
  password: string,
  requirements: IPasswordRequirement[],
  score: number,
): string[] {
  const feedback: string[] = [];
  const unmetRequirements = requirements.filter((req) => !req.met);

  // Specific requirement feedback
  if (unmetRequirements.length > 0) {
    unmetRequirements.forEach((req) => {
      switch (req.id) {
        case "length":
          feedback.push(`Add ${8 - password.length} more characters`);
          break;
        case "character-variety":
          feedback.push(getCharacterTypesSuggestion(password));
          break;
        case "no-common":
          feedback.push("Choose a more unique password");
          break;
        case "no-patterns":
          feedback.push("Avoid repeated characters and sequences");
          break;
      }
    });
  }

  // General strength feedback
  if (score >= 4) {
    feedback.push("Excellent! Very strong password");
  } else if (score >= 3) {
    feedback.push("Good password strength");
  } else if (score >= 2) {
    feedback.push("Fair password - consider improvements");
  } else if (score >= 1) {
    feedback.push("Weak password - needs improvement");
  } else {
    feedback.push("Very weak password - please strengthen");
  }

  return feedback;
}

/**
 * Suggests which character types to add
 */
function getCharacterTypesSuggestion(password: string): string {
  const missing: string[] = [];

  if (!characterPatterns.lowercase.test(password)) missing.push("lowercase");
  if (!characterPatterns.uppercase.test(password)) missing.push("uppercase");
  if (!characterPatterns.numbers.test(password)) missing.push("numbers");
  if (!characterPatterns.special.test(password))
    missing.push("special characters");

  if (missing.length === 0) return "Good character variety";

  return `Add ${missing.slice(0, 2).join(" and ")}`;
}

/**
 * Get password strength level as string for UI display
 */
export function getStrengthLabel(score: number): string {
  switch (score) {
    case 0:
      return "Very Weak";
    case 1:
      return "Weak";
    case 2:
      return "Fair";
    case 3:
      return "Strong";
    case 4:
      return "Very Strong";
    default:
      return "Unknown";
  }
}

/**
 * Get color class for strength indicator
 */
export function getStrengthColor(score: number): string {
  switch (score) {
    case 0:
    case 1:
      return "bg-red-500";
    case 2:
      return "bg-yellow-500";
    case 3:
      return "bg-blue-500";
    case 4:
      return "bg-green-500";
    default:
      return "bg-gray-300";
  }
}
