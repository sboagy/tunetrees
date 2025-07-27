import { chromium } from "playwright";

async function takeScreenshots() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    ignoreHTTPSErrors: true, 
    viewport: { width: 1280, height: 720 }
  });
  const page = await context.newPage();

  try {
    // Take screenshot of login page
    console.log("📸 Taking screenshot of login page...");
    await page.goto("https://localhost:3000/auth/login");
    await page.waitForSelector('[data-testid="user_email"]', { timeout: 10000 });
    await page.screenshot({ 
      path: "/tmp/login-page.png",
      fullPage: true 
    });
    console.log("✅ Login page screenshot saved to /tmp/login-page.png");

    // Take screenshot of signup page
    console.log("📸 Taking screenshot of signup page...");
    await page.goto("https://localhost:3000/auth/newuser");
    await page.waitForSelector('[data-testid="user_email"]', { timeout: 10000 });
    await page.screenshot({ 
      path: "/tmp/signup-page.png",
      fullPage: true 
    });
    console.log("✅ Signup page screenshot saved to /tmp/signup-page.png");

    // Demonstrate loading state by filling form and clicking submit
    console.log("📸 Demonstrating loading state on login form...");
    await page.goto("https://localhost:3000/auth/login");
    await page.waitForSelector('[data-testid="user_email"]');
    
    // Fill form
    await page.fill('[data-testid="user_email"]', "test@example.com");
    await page.fill('[data-testid="user_password"]', "testpassword");
    
    // Take screenshot before submission
    await page.screenshot({ 
      path: "/tmp/login-before-submit.png",
      fullPage: true 
    });
    console.log("✅ Login form (before submit) screenshot saved");

  } catch (error) {
    console.error("Error taking screenshots:", error);
  } finally {
    await browser.close();
  }
}

takeScreenshots();