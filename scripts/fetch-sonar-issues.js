#!/usr/bin/env node

import { writeFileSync } from "node:fs";

const OUTPUT_FILE = "sonar_issues.json";
const PAGE_SIZE = 500;
const PROJECT_KEY = "sboagy_tunetrees";
const ISSUE_TYPE = "CODE_SMELL";
const API_URL = "https://sonarcloud.io/api/issues/search";

function fail(message, details) {
  console.error(message);
  if (details) {
    console.error(details);
  }
  process.exit(1);
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
      `Sonar request failed on page ${page}: ${response.status} ${response.statusText}`,
      `Content-Type: ${contentType}\n${text.slice(0, 400)}`
    );
  }

  if (!contentType.toLowerCase().includes("json")) {
    fail(
      `Unexpected Sonar response content type on page ${page}: ${contentType}`,
      text.slice(0, 400)
    );
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
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
}
