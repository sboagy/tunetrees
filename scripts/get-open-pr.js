#!/usr/bin/env node

import { execFileSync } from "node:child_process";

class FatalError extends Error {
  constructor(message) {
    super(message);
    this.name = "FatalError";
  }
}

function run(command, args) {
  try {
    return execFileSync(command, args, {
      encoding: "utf8",
      env: {
        ...process.env,
        PAGER: "cat",
        GH_PAGER: "cat",
      },
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    throw new FatalError(`Failed to run ${command} ${args.join(" ")}`);
  }
}

function getCurrentBranch() {
  const branch = run("git", ["branch", "--show-current"]);
  if (!branch) {
    throw new FatalError("Could not determine the current git branch.");
  }
  return branch;
}

function getOpenPr(branch) {
  const raw = run("gh", [
    "pr",
    "list",
    "--head",
    branch,
    "--json",
    "number,headRefName,baseRefName,state",
    "--limit",
    "1",
  ]);

  const prs = JSON.parse(raw);
  const pr = prs[0];
  if (!pr) {
    throw new FatalError(`No open pull request found for branch ${branch}.`);
  }
  return pr;
}

function main() {
  const field = process.argv[2] ?? "json";
  const branch = getCurrentBranch();
  const pr = getOpenPr(branch);

  if (field === "number") {
    console.log(pr.number);
    return;
  }

  if (field === "base") {
    console.log(pr.baseRefName);
    return;
  }

  if (field === "head") {
    console.log(pr.headRefName);
    return;
  }

  console.log(JSON.stringify(pr));
}

try {
  main();
} catch (error) {
  if (error instanceof FatalError) {
    console.error(error.message);
  } else {
    console.error("Unexpected failure while resolving the open pull request.");
  }
  process.exitCode = 1;
}
