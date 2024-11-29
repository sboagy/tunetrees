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
