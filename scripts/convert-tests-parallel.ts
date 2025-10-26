#!/usr/bin/env tsx
/**
 * Convert E2E tests to use parallel-safe setup functions
 * Replaces setupFor*Tests with setupFor*TestsParallel
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testsDir = path.join(__dirname, "../e2e/tests");

interface Conversion {
  oldImport?: string;
  newImport?: string;
  oldCall?: RegExp;
  newCall?: string;
}

const conversions: Conversion[] = [
  {
    oldImport: 'import { expect, test } from "@playwright/test";',
    newImport:
      'import { expect } from "@playwright/test";\nimport { test } from "../helpers/test-fixture";',
  },
  {
    oldImport: "import { setupForPracticeTests }",
    newImport: "import { setupForPracticeTestsParallel }",
  },
  {
    oldImport: "import { setupForRepertoireTests }",
    newImport: "import { setupForRepertoireTestsParallel }",
  },
  {
    oldImport: "import { setupForCatalogTests }",
    newImport: "import { setupForCatalogTestsParallel }",
  },
  {
    oldCall: /await setupForPracticeTests\(page,/g,
    newCall: "await setupForPracticeTestsParallel(page, testUser,",
  },
  {
    oldCall: /await setupForRepertoireTests\(page,/g,
    newCall: "await setupForRepertoireTestsParallel(page, testUser,",
  },
  {
    oldCall: /await setupForCatalogTests\(page,/g,
    newCall: "await setupForCatalogTestsParallel(page, testUser,",
  },
];

function updateFile(filePath: string): void {
  let content = fs.readFileSync(filePath, "utf8");
  let changed = false;

  // Skip if already using test-fixture
  if (content.includes('from "../helpers/test-fixture"')) {
    console.log(`✓ Already converted: ${path.basename(filePath)}`);
    return;
  }

  // Skip if no setup functions used
  if (
    !content.includes("setupForPracticeTests") &&
    !content.includes("setupForRepertoireTests") &&
    !content.includes("setupForCatalogTests")
  ) {
    console.log(`- Skipped (no setup): ${path.basename(filePath)}`);
    return;
  }

  // Remove old storageState usage
  if (content.includes('test.use({ storageState: "e2e/.auth/alice.json" });')) {
    content = content.replace(
      /test\.use\(\{ storageState: "e2e\/\.auth\/alice\.json" \}\);\n\n/,
      ""
    );
    changed = true;
  }

  // Update imports
  for (const conv of conversions) {
    if (conv.oldImport && conv.newImport && content.includes(conv.oldImport)) {
      content = content.replace(conv.oldImport, conv.newImport);
      changed = true;
    }
  }

  // Update function calls
  for (const conv of conversions) {
    if (conv.oldCall?.test(content) && conv.newCall) {
      content = content.replace(conv.oldCall, conv.newCall);
      changed = true;
    }
  }

  // Update beforeEach signatures to include testUser
  content = content.replace(
    /test\.beforeEach\(async \(\{ page \}\)/g,
    "test.beforeEach(async ({ page, testUser })"
  );

  if (changed) {
    fs.writeFileSync(filePath, content, "utf8");
    console.log(`✅ Updated: ${path.basename(filePath)}`);
  } else {
    console.log(`- No changes: ${path.basename(filePath)}`);
  }
}

// Process all test files
const files = fs.readdirSync(testsDir).filter((f) => f.endsWith(".spec.ts"));

console.log(
  `\nConverting ${files.length} test files to parallel-safe setup...\n`
);

for (const file of files) {
  updateFile(path.join(testsDir, file));
}

console.log("\n✅ Conversion complete!\n");
