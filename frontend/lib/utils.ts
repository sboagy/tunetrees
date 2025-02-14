import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Parses an object containing query parameters, where each key can have a string or an array of strings as its value,
 * and returns a query string.
 *
 * @param params - An object where each key is a parameter name and the value is either a string or an array of strings.
 * @returns A query string constructed from the provided parameters.
 */
export function parseParamsWithArrays(
  params: Record<string, string | string[]>,
): string {
  let options = "";

  for (const key in params) {
    const value = params[key];

    if (Array.isArray(value)) {
      for (const element of value) {
        options += `${key}=${element}&`;
      }
    } else {
      options += `${key}=${value}&`;
    }
  }

  return options ? options.slice(0, -1) : options;
}

export function levenshteinDistance(a: string, b: string): number {
  const matrix = [];

  // Increment along the first column of each row
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  // Increment each column in the first row
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] =
        b.charAt(i - 1) === a.charAt(j - 1)
          ? matrix[i - 1][j - 1]
          : Math.min(
              matrix[i - 1][j - 1] + 1, // substitution
              matrix[i][j - 1] + 1, // insertion
              matrix[i - 1][j] + 1, // deletion
            );
    }
  }

  return matrix[b.length][a.length];
}
