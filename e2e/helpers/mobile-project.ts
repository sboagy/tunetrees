export function skipIfMobileChrome(
  projectName: string,
  skip: (condition: boolean, description?: string) => void,
  reason: string
): void {
  if (projectName === "Mobile Chrome") {
    skip(true, reason);
  }
}
