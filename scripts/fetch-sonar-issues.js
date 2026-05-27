#!/usr/bin/env node

import { writeFileSync } from "node:fs";

const OUTPUT_FILE = "sonar_issues.json";
const PAGE_SIZE = 500;
const PROJECT_KEY = "sboagy_tunetrees";
const ISSUE_TYPES = ["CODE_SMELL", "BUG", "VULNERABILITY"];
const API_URL = "https://sonarcloud.io/api/issues/search";
const BRANCHES_API_URL = "https://sonarcloud.io/api/project_branches/list";

// Strip control characters to prevent terminal injection from remote data.
const safeConsoleError = (msg) => {
  const str = String(msg ?? "");
  let sanitized = "";
  for (let i = 0; i < str.length; i++) {
    const c = str.codePointAt(i) ?? 0;
    // Allow: tab (9), LF (10), CR (13), space (32) and above
    if (c >= 32 || c === 9 || c === 10 || c === 13) {
      sanitized += str[i];
    }
  }
  console.error(sanitized);
};

class FatalError extends Error {
  constructor(message) {
    super(message);
    this.name = "FatalError";
  }
}

function fail(message) {
  throw new FatalError(message);
}

function getAnalysisScope() {
  const pullRequest = process.env.SONAR_PULL_REQUEST?.trim();
  if (pullRequest) {
    return { key: "pullRequest", value: pullRequest };
  }

  const branch =
    process.env.SONAR_BRANCH?.trim() ||
    process.env.GITHUB_HEAD_REF?.trim() ||
    process.env.GITHUB_REF_NAME?.trim();

  if (branch) {
    return { key: "branch", value: branch };
  }

  return null;
}

async function fetchPage(token, page, scope) {
  const url = new URL(API_URL);
  url.searchParams.append("projectKeys", PROJECT_KEY);
  url.searchParams.append("types", ISSUE_TYPES.join(","));
  url.searchParams.append("ps", String(PAGE_SIZE));
  url.searchParams.append("p", String(page));
  if (scope) {
    url.searchParams.append(scope.key, scope.value);
  }

  const response = await fetch(url.href, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  const text = await response.text();
  const contentType = response.headers.get("content-type") || "unknown";

  if (!response.ok) {
    fail(
      `Sonar request failed on page ${page} with status ${response.status}.`
    );
  }

  if (!contentType.toLowerCase().includes("json")) {
    fail(`Sonar returned a non-JSON response on page ${page}.`);
  }

  return JSON.parse(text);
}

async function fetchBranchInfo(token, branchName) {
  const url = new URL(BRANCHES_API_URL);
  url.searchParams.append("project", PROJECT_KEY);

  const response = await fetch(url.href, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  return data.branches?.find((branch) => branch.name === branchName) ?? null;
}

async function main() {
  const token = process.env.SONAR_TOKEN;
  if (!token) {
    fail("Missing SONAR_TOKEN");
  }

  const scope = getAnalysisScope();
  const branchInfo =
    scope?.key === "branch" ? await fetchBranchInfo(token, scope.value) : null;

  const allIssues = [];
  const components = new Map();
  const organizations = new Map();
  let firstPage = null;
  let totalPages = 1;

  for (let page = 1; page <= totalPages; page += 1) {
    const data = await fetchPage(token, page, scope);

    if (!firstPage) {
      firstPage = data;
      const total = data.paging?.total ?? data.total ?? 0;
      totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    }

    allIssues.push(...(data.issues ?? []));

    for (const component of data.components ?? []) {
      components.set(
        component.key ??
          component.path ??
          component.longName ??
          JSON.stringify(component),
        component
      );
    }

    for (const organization of data.organizations ?? []) {
      organizations.set(
        organization.key ?? organization.name ?? JSON.stringify(organization),
        organization
      );
    }
  }

  const PROJECT_PREFIX = `${PROJECT_KEY}:`;

  // Filter out issues for files that no longer exist locally.
  const { existsSync } = await import("node:fs");
  const liveIssues = allIssues.filter((issue) => {
    const relPath = issue.component?.startsWith(PROJECT_PREFIX)
      ? issue.component.slice(PROJECT_PREFIX.length)
      : issue.component;
    // Always keep issues without a clear file path (e.g. project-level).
    if (
      !relPath ||
      relPath === PROJECT_KEY ||
      relPath.includes("/") === false
    ) {
      return true;
    }
    return existsSync(relPath);
  });

  const dropped = allIssues.length - liveIssues.length;
  if (dropped > 0) {
    safeConsoleError(
      `Filtered out ${dropped} issue(s) from deleted/renamed files.`
    );
  }

  const output = {
    ...firstPage,
    scope,
    branchInfo,
    issueTypes: ISSUE_TYPES,
    total: liveIssues.length,
    ps: liveIssues.length,
    p: 1,
    paging: {
      pageIndex: 1,
      pageSize: liveIssues.length,
      total: liveIssues.length,
    },
    issues: liveIssues,
    components: [...components.values()],
    organizations: [...organizations.values()],
    fetchedPages: totalPages,
  };

  writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  const scopeLabel = scope ? ` for ${scope.key}=${scope.value}` : "";
  if (branchInfo?.type === "SHORT") {
    safeConsoleError(
      `Note: ${scope?.value} is a SHORT branch in SonarCloud, so branch analysis only reports issues introduced by this branch relative to its target. Use sonar:issues:main for the overall backlog, or configure this branch as long-lived in SonarCloud if you want whole-branch issue results.`
    );
  }
  console.log(
    `Success! Saved ${liveIssues.length} issues to ${OUTPUT_FILE} across ${totalPages} pages${scopeLabel}`
  );
}

try {
  await main();
} catch (error) {
  if (error instanceof FatalError) {
    safeConsoleError(error.message);
  } else {
    safeConsoleError("Unexpected failure while fetching Sonar issues.");
  }
  process.exitCode = 1;
}
