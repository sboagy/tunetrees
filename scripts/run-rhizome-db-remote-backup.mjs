import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

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

  const result = spawnSync(
    "npm",
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
