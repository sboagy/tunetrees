import { accessSync, constants, statSync } from "node:fs";
import { delimiter, isAbsolute, join } from "node:path";

/**
 * Pin a CLI to an absolute path before spawning it. Ignore relative and
 * group/world-writable PATH entries so another user cannot substitute a binary.
 * A custom installation can be selected explicitly with an absolute override.
 */
export function resolveExecutable(
  name,
  override,
  searchPath = process.env.PATH || ""
) {
  function isExecutable(file) {
    try {
      accessSync(file, constants.X_OK);
      const info = statSync(file);
      return info.isFile() && (info.mode & 0o022) === 0;
    } catch {
      return false;
    }
  }

  if (override !== undefined) {
    if (!isAbsolute(override) || !isExecutable(override)) {
      throw new Error(
        `${name} override must be an absolute executable file path`
      );
    }
    return override;
  }

  for (const directory of searchPath.split(delimiter)) {
    if (!isAbsolute(directory)) continue;
    try {
      const info = statSync(directory);
      if (!info.isDirectory() || (info.mode & 0o022) !== 0) continue;
    } catch {
      continue;
    }
    const executable = join(directory, name);
    if (isExecutable(executable)) return executable;
  }
  throw new Error(
    `No executable ${name} found in a trusted absolute PATH directory`
  );
}
