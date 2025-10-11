import { expect, test } from "@playwright/test";

// Helper to login first
async function loginUser(page: any) {
  const testUsername =
    process.env.TUNETREES_TEST_USERNAME || "sboagy@gmail.com";
  const testPassword =
    process.env.TUNETREES_TEST_PASSWORD || "serf.pincers3BITTERS";

  await page.goto("/login");
  await page.locator('input[type="email"]').fill(testUsername);
  await page.locator('input[type="password"]').fill(testPassword);
  await page.locator('button:has-text("Sign In")').click();

  // Wait for auth state to settle
  await page.waitForTimeout(3000);
}

test.describe("Genre Fix Verification", () => {
  test("verify genre dropdown actually shows genres in catalog tab", async ({
    page,
  }) => {
    console.log("=== VERIFYING GENRE FIX IN ACTUAL UI ===");

    // Enable console logging from the page
    page.on("console", (msg) => {
      console.log(`🔍 Browser Console: ${msg.text()}`);
    });

    // Set Playwright flag to prevent auto-closing dropdown during tests
    await page.addInitScript(() => {
      (window as any).__PLAYWRIGHT__ = true;
    });

    // Login first
    await loginUser(page);

    // Navigate to catalog tab
    await page.goto("/?tab=catalog");
    await page.waitForTimeout(3000); // Wait for data to load

    console.log("Current URL:", page.url());

    // Take a screenshot to see what's actually rendered
    // await page.screenshot({
    //   path: "../../test-results/catalog-genre-verification.png",
    //   fullPage: true,
    // });

    // Look for the filter button/dropdown - try different selectors
    const filterSelectors = [
      '[data-testid="combined-filter-button"]',
      'button:has-text("Filters")',
      'button:has-text("Filter")',
      ".filter",
      '[aria-label*="filter"]',
      '[aria-label*="Filter"]',
    ];

    let filterButton = null;
    for (const selector of filterSelectors) {
      const element = page.locator(selector);
      if ((await element.count()) > 0) {
        console.log(`Found filter button with selector: ${selector}`);
        filterButton = element;
        break;
      }
    }

    if (!filterButton) {
      console.log("❌ No filter button found with any selector");

      // Log all buttons on the page to see what's available
      const allButtons = page.locator("button");
      const buttonCount = await allButtons.count();
      console.log(`Found ${buttonCount} buttons on page:`);

      for (let i = 0; i < Math.min(buttonCount, 10); i++) {
        const buttonText = await allButtons.nth(i).textContent();
        const buttonClasses = await allButtons.nth(i).getAttribute("class");
        console.log(`Button ${i}: "${buttonText}" classes="${buttonClasses}"`);
      }

      // Also check for any elements that might contain genre info
      const genreElements = await page.locator('*:has-text("genre")').count();
      const genreElementsCase = await page
        .locator('*:has-text("Genre")')
        .count();
      console.log(`Elements containing "genre": ${genreElements}`);
      console.log(`Elements containing "Genre": ${genreElementsCase}`);

      throw new Error("Could not find filter button");
    }

    // Click the filter button
    await page.waitForTimeout(1000);

    // console.log("Pausing test for 2 minutes for manual inspection...");
    // await page.waitForTimeout(4 * 60 * 1000);
    // console.log("Resuming test after manual inspection.");

    await filterButton.isVisible();
    await filterButton.isEnabled();
    await filterButton.click();
    await page.waitForTimeout(2000);

    console.log("TAKING SCREENSHOT AFTER CLICK");
    await page.screenshot({
      // path: "test-results/catalog-search-dropdown-after-click.png",
      fullPage: true,
    });

    // DO NOT DELETE THIS COMMENT!
    console.log("Pausing test for 2 minutes for manual inspection...");
    await page.waitForTimeout(6 * 60 * 1000);
    console.log("Resuming test after manual inspection.");

    // FOR RIGHT NOW, THE TEST ENDS HERE, WE JUST WANT COPILOT TO OBSERVE
    // "test-results/catalog-search-dropdown-after-click.png"

    // // Take another screenshot after clicking
    // await page.screenshot({
    //   path: "test-results/catalog-filter-dropdown-open.png",
    //   fullPage: true,
    // });

    // // // DO NOT REMOVE THIS COMMENT!!!
    // // console.log("Pausing test for 3 minutes for manual inspection...");
    // // await page.waitForTimeout(3 * 60 * 1000);
    // // console.log("Resuming test after manual inspection.");

    // // Wait for any dropdown content to appear
    // await page.waitForTimeout(500);

    // // Look for organized dropdown content (new FilterPanel design)
    // const filterSections = [
    //   'text="Type"',
    //   'text="Mode"',
    //   'text="Genre"',
    //   'text="Playlist"',
    //   // Headers from new organized design
    //   'text="Filters"',
    //   ".space-y-4", // organized sections container
    //   'text="Active Filters:"',
    // ];

    // let foundOrganizedDropdown = false;
    // for (const selector of filterSections) {
    //   const element = page.locator(selector);
    //   if ((await element.count()) > 0) {
    //     console.log(`✅ Found organized dropdown content with: ${selector}`);
    //     foundOrganizedDropdown = true;
    //     break;
    //   }
    // }

    // if (!foundOrganizedDropdown) {
    //   console.log("❌ No organized dropdown content found");

    //   // Look for old basic checkbox content
    //   const oldDropdownIndicators = [
    //     ".grid.grid-cols-4", // old 4-column grid
    //     ".grid.grid-cols-2", // old 2-column grid
    //     ".grid.grid-cols-1", // old 1-column grid
    //     'input[type="checkbox"]', // basic checkboxes
    //   ];

    //   let foundOldDropdown = false;
    //   for (const selector of oldDropdownIndicators) {
    //     const element = page.locator(selector);
    //     if ((await element.count()) > 0) {
    //       console.log(`❌ Found OLD basic checkbox layout: ${selector}`);
    //       foundOldDropdown = true;
    //       break;
    //     }
    //   }

    //   if (!foundOldDropdown) {
    //     console.log("❌ No dropdown content found at all!");
    //   }

    //   // Log all text content visible on page
    //   const bodyText = await page.locator("body").textContent();
    //   console.log(
    //     "Page content (first 1000 chars):",
    //     bodyText?.substring(0, 1000)
    //   );

    //   throw new Error(
    //     "FilterPanel organized dropdown is not rendering - still showing old basic layout or no dropdown"
    //   );
    // }

    // console.log("✅ Found organized FilterPanel dropdown!");

    // // List all visible sections in the dropdown
    // const allSections = await page
    //   .locator("h4.text-sm.font-medium")
    //   .allTextContents();
    // console.log("Available filter sections:", allSections);

    // // Also check for any h3 or h4 headers
    // const h3Headers = await page.locator("h3").allTextContents();
    // const h4Headers = await page.locator("h4").allTextContents();
    // console.log("All H3 headers:", h3Headers);
    // console.log("All H4 headers:", h4Headers);

    // // Check if the dropdown is still open immediately
    // const dropdownArea = page.locator("div.absolute.right-0.top-full");
    // const isDropdownVisible = await dropdownArea.isVisible();
    // console.log("Is dropdown still visible?", isDropdownVisible);

    // if (!isDropdownVisible) {
    //   console.log("❌ Dropdown closed too quickly! Taking screenshot...");
    //   await page.screenshot({
    //     path: "test-results/catalog-search-dropdown-after-click.png",
    //     fullPage: true,
    //   });
    //   throw new Error("Dropdown closed immediately after clicking");
    // }

    // // Check all text content in the dropdown
    // const dropdownText = await dropdownArea.textContent();
    // console.log("Full dropdown content:", dropdownText);

    // // Now look specifically for genre section in the organized dropdown
    // const genreSelectors = [
    //   'text="Genre"',
    //   '*:has-text("Genre")',
    //   '*:has-text("No genres available")',
    // ];

    // let genreSection = null;
    // for (const selector of genreSelectors) {
    //   const element = page.locator(selector);
    //   if ((await element.count()) > 0) {
    //     console.log(`Found genre section with selector: ${selector}`);
    //     genreSection = element;
    //     break;
    //   }
    // }

    // if (!genreSection) {
    //   console.log("❌ No genre section found in organized dropdown");
    //   throw new Error("Could not find genre section in FilterPanel dropdown");
    // }

    // // Check if we see "No genres available" or actual genre names
    // const noGenresText = page.locator('text="No genres available"');
    // const hasNoGenres = (await noGenresText.count()) > 0;

    // if (hasNoGenres) {
    //   console.log("❌ STILL SHOWING 'No genres available'");

    //   // Check console logs for any errors
    //   page.on("console", (msg) => {
    //     if (
    //       msg.type() === "error" ||
    //       msg.text().includes("DEBUG") ||
    //       msg.text().includes("genre")
    //     ) {
    //       console.log(`Console ${msg.type()}: ${msg.text()}`);
    //     }
    //   });

    //   await expect(noGenresText).not.toBeVisible();
    // } else {
    //   console.log(
    //     "✅ Genre section found, checking for actual genre options..."
    //   );

    //   // Look for specific genre names we actually have (from console: "Bluegrass Music", "Irish Traditional Music")
    //   const bluegrassGenre = page.locator('text="Bluegrass Music"');
    //   const irishGenre = page.locator('text="Irish Traditional Music"');

    //   const hasBluegrass = (await bluegrassGenre.count()) > 0;
    //   const hasIrish = (await irishGenre.count()) > 0;

    //   console.log(`Bluegrass Music found: ${hasBluegrass}`);
    //   console.log(`Irish Traditional Music found: ${hasIrish}`);

    //   if (hasBluegrass || hasIrish) {
    //     console.log("✅ SUCCESS: Genres are now showing in the dropdown!");
    //   } else {
    //     console.log("⚠️  Genre section exists but expected genres not found");

    //     // Log what genre options are actually available
    //     const allOptions = page.locator(
    //       '[role="option"], .option, input[type="checkbox"] + label'
    //     );
    //     const optionCount = await allOptions.count();
    //     console.log(`Found ${optionCount} potential option elements:`);

    //     for (let i = 0; i < Math.min(optionCount, 10); i++) {
    //       const optionText = await allOptions.nth(i).textContent();
    //       console.log(`Option ${i}: "${optionText}"`);
    //     }
    //   }
    // }

    // console.log("=== GENRE VERIFICATION COMPLETE ===");
  });
});
