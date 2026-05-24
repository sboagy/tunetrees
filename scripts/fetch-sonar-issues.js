#!/usr/bin/env node

import { writeFileSync } from "node:fs";

const OUTPUT_FILE = "sonar_issues.json";
const PAGE_SIZE = 500;
const PROJECT_KEY = "sboagy_tunetrees";
const ISSUE_TYPE = "CODE_SMELL";
const API_URL = "https://sonarcloud.io/api/issues/search";

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

async function fetchPage(token, page) {
  const url = new URL(API_URL);
  url.searchParams.append("projectKeys", PROJECT_KEY);
  url.searchParams.append("types", ISSUE_TYPE);
  url.searchParams.append("ps", String(PAGE_SIZE));
  url.searchParams.append("p", String(page));

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

async function main() {
  const token = process.env.SONAR_TOKEN;
  if (!token) {
    fail("Missing SONAR_TOKEN");
  }

  const allIssues = [];
  const components = new Map();
  const organizations = new Map();
  let firstPage = null;
  let totalPages = 1;

  for (let page = 1; page <= totalPages; page += 1) {
    const data = await fetchPage(token, page);

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

  const output = {
    ...firstPage,
    total: allIssues.length,
    ps: allIssues.length,
    p: 1,
    paging: {
      pageIndex: 1,
      pageSize: allIssues.length,
      total: allIssues.length,
    },
    issues: allIssues,
    components: [...components.values()],
    organizations: [...organizations.values()],
    fetchedPages: totalPages,
  };

  writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  console.log(
    `Success! Saved ${allIssues.length} code smells to ${OUTPUT_FILE} across ${totalPages} pages`
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
