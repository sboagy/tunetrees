#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";

const REPORT_TASK_FILES = [".scannerwork/report-task.txt", "report-task.txt"];
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;
const POLL_INTERVAL_MS = 5000;

class FatalError extends Error {
  constructor(message) {
    super(message);
    this.name = "FatalError";
  }
}

function fail(message) {
  throw new FatalError(message);
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function parseProperties(rawText) {
  const props = new Map();
  for (const line of rawText.split(/\r?\n/u)) {
    if (!line || line.startsWith("#")) {
      continue;
    }

    const equalsIndex = line.indexOf("=");
    if (equalsIndex === -1) {
      continue;
    }

    const key = line.slice(0, equalsIndex).trim();
    const value = line.slice(equalsIndex + 1).trim();
    if (key) {
      props.set(key, value);
    }
  }
  return props;
}

function findReportTaskFile() {
  return REPORT_TASK_FILES.find((filePath) => existsSync(filePath)) ?? null;
}

async function fetchTaskStatus(url, token) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    fail(`Sonar task status request failed with status ${response.status}.`);
  }

  return response.json();
}

async function main() {
  const token = process.env.SONAR_TOKEN;
  if (!token) {
    fail("Missing SONAR_TOKEN");
  }

  const reportTaskPath = findReportTaskFile();
  if (!reportTaskPath) {
    fail("Could not find Sonar report-task.txt from the most recent scan.");
  }

  const reportTask = parseProperties(readFileSync(reportTaskPath, "utf8"));
  const serverUrl = reportTask.get("serverUrl") || "https://sonarcloud.io";
  const ceTaskId = reportTask.get("ceTaskId");

  if (!ceTaskId) {
    fail(`Missing ceTaskId in ${reportTaskPath}.`);
  }

  const taskUrl = new URL("/api/ce/task", serverUrl);
  taskUrl.searchParams.append("id", ceTaskId);

  const startedAt = Date.now();
  while (Date.now() - startedAt < DEFAULT_TIMEOUT_MS) {
    const data = await fetchTaskStatus(taskUrl, token);
    const task = data.task;
    const status = task?.status;

    if (status === "SUCCESS") {
      const analysisId = task.analysisId
        ? ` (analysisId=${task.analysisId})`
        : "";
      console.log(`Sonar analysis is ready${analysisId}.`);
      return;
    }

    if (status === "FAILED" || status === "CANCELED") {
      const errorMessage = task?.errorMessage ? ` ${task.errorMessage}` : "";
      fail(`Sonar analysis ended with status ${status}.${errorMessage}`);
    }

    await sleep(POLL_INTERVAL_MS);
  }

  fail("Timed out waiting for Sonar analysis to complete.");
}

try {
  await main();
} catch (error) {
  if (error instanceof FatalError) {
    console.error(error.message);
  } else {
    console.error("Unexpected failure while waiting for Sonar analysis.");
  }
  process.exitCode = 1;
}
