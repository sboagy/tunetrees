import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const filesToPatch = [
  "node_modules/@supabase/storage-js/dist/module/lib/types.js",
  "node_modules/@supabase/storage-js/dist/module/lib/vectors/types.js",
];

const stripSourceMap = (filePath) => {
  if (!existsSync(filePath)) return false;
  const original = readFileSync(filePath, "utf8");
  const strippedLines = original
    .split(/\r?\n/)
    .filter((line) => !line.includes("sourceMappingURL="));
  const stripped = strippedLines.join("\n").trimEnd().concat("\n");
  if (stripped !== original) {
    writeFileSync(filePath, stripped, "utf8");
    return true;
  }
  return false;
};

const writeEmptySourceMap = (mapPath) => {
  mkdirSync(path.dirname(mapPath), { recursive: true });
  const content = JSON.stringify({
    version: 3,
    file: path.basename(mapPath, ".map"),
    sources: [],
    sourcesContent: [],
    names: [],
    mappings: "",
  });
  writeFileSync(mapPath, content, "utf8");
};

const mirrorIntoSrcNodeModules = (relativePath) => {
  const sourcePath = path.resolve(process.cwd(), relativePath);
  if (!existsSync(sourcePath)) return false;
  const mirrorPath = path.resolve(process.cwd(), "src", relativePath);
  mkdirSync(path.dirname(mirrorPath), { recursive: true });
  const content = readFileSync(sourcePath, "utf8");
  writeFileSync(mirrorPath, content, "utf8");
  writeEmptySourceMap(`${mirrorPath}.map`);
  return true;
};

for (const relativePath of filesToPatch) {
  const absolutePath = path.resolve(process.cwd(), relativePath);
  const patched = stripSourceMap(absolutePath);
  if (patched) {
    console.log(
      `[patch-supabase-sourcemaps] Stripped sourceMappingURL from ${relativePath}`
    );
  }
  const mirrored = mirrorIntoSrcNodeModules(relativePath);
  if (mirrored) {
    console.log(
      `[patch-supabase-sourcemaps] Mirrored ${relativePath} into src/node_modules`
    );
  }
}
