import fs from "node:fs";
import path from "node:path";
import type { Page, TestInfo } from "@playwright/test";
import { outputDir } from "./paths-for-tests";

export function doConsolelogs(page: Page, testInfo: TestInfo) {
  const fileNamePart = path.parse(testInfo.file).name;
  const testNamePart = testInfo.title.replaceAll(/\s+/g, "_");
  const testOutputDir = path.join(
    outputDir,
    `${fileNamePart}.ts-${testNamePart}-${testInfo.project.name}`,
  );
  console.log("===> writing console output to ", testOutputDir);
  fs.mkdirSync(testOutputDir, { recursive: true });
  const logFile = path.join(testOutputDir, "console.log");
  const logStream = fs.createWriteStream(logFile, { flags: "a" });

  page.on("console", (msg) => {
    logStream.write(`${msg.type()}: ${msg.text()}\n`);
  });

  testInfo.attachments.push({
    name: "console.log",
    path: logFile,
    contentType: "text/plain",
  });
}
