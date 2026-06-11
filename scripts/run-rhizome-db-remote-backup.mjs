import { execSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

/** Resolve a command name to its absolute path so spawnSync never searches PATH. */
function resolveBin(name) {
  const resolved = execSync(`command -v ${name}`, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
  if (!resolved) {
    throw new Error(`Could not resolve binary: ${name}`);
  }
  return resolved;
}

function repoHasPackageJson(dirPath) {
  return existsSync(path.join(dirPath, "package.json"));
}

function findRhizomeRepo(repoRoot) {
  const envPath = process.env.RHIZOME_REPO_PATH;
  if (envPath && repoHasPackageJson(envPath)) {
    return envPath;
  }

  const parent = path.resolve(repoRoot, "..");
  const grandparent = path.resolve(repoRoot, "..", "..");
  const directCandidates = [
    path.join(repoRoot, "rhizome"),
    path.join(parent, "rhizome"),
    path.join(grandparent, "rhizome"),
  ];

  for (const candidate of directCandidates) {
    if (repoHasPackageJson(candidate)) {
      return candidate;
    }
  }

  const worktreesDir = path.join(grandparent, "rhizome.worktrees");
  if (existsSync(worktreesDir)) {
    const worktreeCandidates = readdirSync(worktreesDir)
      .map((entry) => path.join(worktreesDir, entry))
      .filter(repoHasPackageJson);
    if (worktreeCandidates.length === 1) {
      return worktreeCandidates[0];
    }
  }

  throw new Error(
    "Unable to locate the rhizome repository. Set RHIZOME_REPO_PATH to the rhizome repo root."
  );
}

function main() {
  const repoRoot = process.cwd();
  const rhizomeRepo = findRhizomeRepo(repoRoot);
  const forwardedArgs = process.argv.slice(2);

  console.log(
    `[tunetrees] Delegating remote DB backup to rhizome at ${rhizomeRepo}`
  );

  const npmPath = resolveBin("npm");
  const result = spawnSync(
    npmPath,
    ["run", "db:remote:backup", "--", ...forwardedArgs],
    {
      cwd: rhizomeRepo,
      stdio: "inherit",
    }
  );

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

main();
