#!/usr/bin/env node

/**
 * Performance Testing Script
 *
 * Runs Lighthouse audits locally and generates reports.
 * Useful for quick performance checks during development.
 *
 * Usage:
 *   npm run build && node scripts/performance-test.js
 *
 * Options:
 *   --desktop   Test desktop performance (default)
 *   --mobile    Test mobile performance (Moto G4)
 *   --both      Test both desktop and mobile
 *   --view      Open reports in browser
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const args = process.argv.slice(2);
const testDesktop =
  args.includes("--desktop") || args.includes("--both") || args.length === 0;
const testMobile = args.includes("--mobile") || args.includes("--both");
const openReports = args.includes("--view");

const LIGHTHOUSE_CONFIG = {
  desktop: {
    preset: "desktop",
    formFactor: "desktop",
    throttling: {
      rttMs: 40,
      throughputKbps: 10240,
      cpuSlowdownMultiplier: 1,
    },
    screenEmulation: {
      mobile: false,
      width: 1350,
      height: 940,
      deviceScaleFactor: 1,
    },
  },
  mobile: {
    preset: "mobile",
    formFactor: "mobile",
    throttling: {
      rttMs: 150,
      throughputKbps: 1600,
      cpuSlowdownMultiplier: 4,
    },
    screenEmulation: {
      mobile: true,
      width: 360,
      height: 640,
      deviceScaleFactor: 2,
    },
  },
};

async function ensureReportsDir() {
  const reportsDir = join(process.cwd(), "lighthouse-reports");
  if (!existsSync(reportsDir)) {
    await mkdir(reportsDir, { recursive: true });
  }
  return reportsDir;
}

function runLighthouse(url, config, outputPath) {
  return new Promise((resolve, reject) => {
    const args = [
      url,
      "--output=html",
      "--output=json",
      `--output-path=${outputPath}`,
      `--preset=${config.preset}`,
      `--throttling.rttMs=${config.throttling.rttMs}`,
      `--throttling.throughputKbps=${config.throttling.throughputKbps}`,
      `--throttling.cpuSlowdownMultiplier=${config.throttling.cpuSlowdownMultiplier}`,
      `--screenEmulation.mobile=${config.screenEmulation.mobile}`,
      `--screenEmulation.width=${config.screenEmulation.width}`,
      `--screenEmulation.height=${config.screenEmulation.height}`,
      `--screenEmulation.deviceScaleFactor=${config.screenEmulation.deviceScaleFactor}`,
      '--chrome-flags="--headless --no-sandbox"',
    ];

    if (openReports) {
      args.push("--view");
    }

    console.log(`\n🔦 Running Lighthouse (${config.preset})...`);
    console.log(`   URL: ${url}`);
    console.log(`   Output: ${outputPath}.html`);

    const lighthouse = spawn("npx", ["lighthouse", ...args], {
      stdio: "inherit",
      shell: true,
    });

    lighthouse.on("close", (code) => {
      if (code === 0) {
        console.log(`✅ Lighthouse audit complete (${config.preset})`);
        resolve();
      } else {
        reject(new Error(`Lighthouse failed with code ${code}`));
      }
    });
  });
}

async function startPreviewServer() {
  return new Promise((resolve, reject) => {
    console.log("\n🚀 Starting preview server...");

    const preview = spawn("npm", ["run", "preview"], {
      stdio: "pipe",
      shell: true,
    });

    preview.stdout.on("data", (data) => {
      const output = data.toString();
      console.log(output);

      // Look for "Local: http://localhost:4173"
      const match = output.match(/Local:\s+(http:\/\/localhost:\d+)/);
      if (match) {
        console.log(`✅ Preview server running at ${match[1]}`);
        resolve({ url: match[1], process: preview });
      }
    });

    preview.stderr.on("data", (data) => {
      console.error(data.toString());
    });

    preview.on("close", (code) => {
      if (code !== 0 && code !== null) {
        reject(new Error(`Preview server exited with code ${code}`));
      }
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      reject(new Error("Preview server failed to start within 30 seconds"));
    }, 30000);
  });
}

async function main() {
  console.log("=".repeat(60));
  console.log("TuneTrees Performance Testing");
  console.log("=".repeat(60));

  // Check if dist exists
  if (!existsSync(join(process.cwd(), "dist"))) {
    console.error("\n❌ Error: dist/ folder not found");
    console.error("   Please run: npm run build");
    process.exit(1);
  }

  const reportsDir = await ensureReportsDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);

  let server;
  try {
    // Start preview server
    server = await startPreviewServer();
    const url = server.url;

    // Wait a bit for server to be fully ready
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Run audits
    if (testDesktop) {
      const outputPath = join(reportsDir, `desktop-${timestamp}`);
      await runLighthouse(url, LIGHTHOUSE_CONFIG.desktop, outputPath);
    }

    if (testMobile) {
      const outputPath = join(reportsDir, `mobile-${timestamp}`);
      await runLighthouse(url, LIGHTHOUSE_CONFIG.mobile, outputPath);
    }

    console.log("\n=".repeat(60));
    console.log("✅ All audits complete!");
    console.log(`📊 Reports saved to: ${reportsDir}`);
    console.log("=".repeat(60));
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  } finally {
    // Clean up
    if (server?.process) {
      console.log("\n🛑 Stopping preview server...");
      server.process.kill();
    }
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
