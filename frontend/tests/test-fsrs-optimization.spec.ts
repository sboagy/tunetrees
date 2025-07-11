/**
 * E2E tests for FSRS optimization functionality in the scheduling options form.
 */

import { test, expect } from "@playwright/test";

test.describe("FSRS Optimization Tests", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to scheduling options page
    await page.goto("/user-settings/scheduling-options");

    // Wait for the page to load
    await page.waitForLoadState("networkidle");
  });

  test("should display auto-optimize button when FSRS is selected", async ({
    page,
  }) => {
    // Check if FSRS algorithm is available and select it
    const fsrsRadio = page.locator('input[type="radio"][value="FSRS"]');
    if (await fsrsRadio.isVisible()) {
      await fsrsRadio.check();

      // Auto-optimize button should be visible
      const optimizeButton = page.locator(
        'button:has-text("Auto-Optimize Parameters")',
      );
      await expect(optimizeButton).toBeVisible();
    }
  });

  test("should hide auto-optimize button when SM2 is selected", async ({
    page,
  }) => {
    // Select SM2 algorithm
    const sm2Radio = page.locator('input[type="radio"][value="SM2"]');
    if (await sm2Radio.isVisible()) {
      await sm2Radio.check();

      // Auto-optimize button should not be visible
      const optimizeButton = page.locator(
        'button:has-text("Auto-Optimize Parameters")',
      );
      await expect(optimizeButton).not.toBeVisible();
    }
  });

  test("should show loading state when optimization is triggered", async ({
    page,
  }) => {
    // Select FSRS algorithm first
    const fsrsRadio = page.locator('input[type="radio"][value="FSRS"]');
    if (await fsrsRadio.isVisible()) {
      await fsrsRadio.check();

      // Click the auto-optimize button
      const optimizeButton = page.locator(
        'button:has-text("Auto-Optimize Parameters")',
      );
      if (await optimizeButton.isVisible()) {
        // Mock the API response to simulate success
        await page.route("**/preferences/optimize_fsrs*", async (route) => {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              message: "FSRS optimization completed successfully",
              user_id: 1,
              algorithm: "FSRS",
              review_count: 25,
              loss: 0.15,
              optimized_parameters: [
                0.4, 0.9, 2.3, 10.9, 4.93, 1, 0.94, 0.86, 1.01, 1.49, 0.14,
                1.74, 0, 1.46, 1.66, 0.24, 1,
              ],
              scheduler_config: {
                desired_retention: 0.9,
                maximum_interval: 36500,
                enable_fuzzing: true,
              },
            }),
          });
        });

        await optimizeButton.click();

        // Check for loading state
        await expect(optimizeButton).toContainText("Optimizing...");

        // Wait for completion and check for success message
        await expect(
          page.locator("text=Parameters optimized successfully"),
        ).toBeVisible({ timeout: 10000 });
      }
    }
  });

  test("should handle insufficient review history error", async ({ page }) => {
    // Select FSRS algorithm first
    const fsrsRadio = page.locator('input[type="radio"][value="FSRS"]');
    if (await fsrsRadio.isVisible()) {
      await fsrsRadio.check();

      const optimizeButton = page.locator(
        'button:has-text("Auto-Optimize Parameters")',
      );
      if (await optimizeButton.isVisible()) {
        // Mock API response for insufficient data
        await page.route("**/preferences/optimize_fsrs*", async (route) => {
          await route.fulfill({
            status: 400,
            contentType: "application/json",
            body: JSON.stringify({
              detail:
                "Insufficient review history: 5 records. Need at least 10.",
            }),
          });
        });

        await optimizeButton.click();

        // Check for error message
        await expect(
          page.locator("text=Insufficient review history"),
        ).toBeVisible({ timeout: 10000 });
      }
    }
  });

  test("should handle optimization server error gracefully", async ({
    page,
  }) => {
    // Select FSRS algorithm first
    const fsrsRadio = page.locator('input[type="radio"][value="FSRS"]');
    if (await fsrsRadio.isVisible()) {
      await fsrsRadio.check();

      const optimizeButton = page.locator(
        'button:has-text("Auto-Optimize Parameters")',
      );
      if (await optimizeButton.isVisible()) {
        // Mock API response for server error
        await page.route("**/preferences/optimize_fsrs*", async (route) => {
          await route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({
              detail:
                "Error during FSRS optimization: Database connection failed",
            }),
          });
        });

        await optimizeButton.click();

        // Check for error message
        await expect(
          page.locator("text=Error during FSRS optimization"),
        ).toBeVisible({ timeout: 10000 });
      }
    }
  });

  test("should update form fields after successful optimization", async ({
    page,
  }) => {
    // Select FSRS algorithm first
    const fsrsRadio = page.locator('input[type="radio"][value="FSRS"]');
    if (await fsrsRadio.isVisible()) {
      await fsrsRadio.check();

      const optimizeButton = page.locator(
        'button:has-text("Auto-Optimize Parameters")',
      );
      if (await optimizeButton.isVisible()) {
        // Mock successful optimization response
        await page.route("**/preferences/optimize_fsrs*", async (route) => {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              message: "FSRS optimization completed successfully",
              user_id: 1,
              algorithm: "FSRS",
              review_count: 25,
              loss: 0.15,
              optimized_parameters: [
                0.4, 0.9, 2.3, 10.9, 4.93, 1, 0.94, 0.86, 1.01, 1.49, 0.14,
                1.74, 0, 1.46, 1.66, 0.24, 1,
              ],
              scheduler_config: {
                desired_retention: 0.9,
                maximum_interval: 36500,
                enable_fuzzing: true,
              },
            }),
          });
        });

        // Mock the preferences update endpoint
        await page.route(
          "**/preferences/prefs_spaced_repetition*",
          async (route) => {
            if (
              route.request().method() === "PUT" ||
              route.request().method() === "POST"
            ) {
              await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({
                  id: 1,
                  user_id: 1,
                  alg_type: "FSRS",
                  fsrs_weights:
                    "[0.4, 0.9, 2.3, 10.9, 4.93, 1, 0.94, 0.86, 1.01, 1.49, 0.14, 1.74, 0, 1.46, 1.66, 0.24, 1]",
                  request_retention: 0.9,
                  maximum_interval: 36500,
                  enable_fuzz: true,
                }),
              });
            } else {
              // Handle GET request
              await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({
                  id: 1,
                  user_id: 1,
                  alg_type: "FSRS",
                  fsrs_weights:
                    "[0.4, 0.9, 2.3, 10.9, 4.93, 1, 0.94, 0.86, 1.01, 1.49, 0.14, 1.74, 0, 1.46, 1.66, 0.24, 1]",
                  request_retention: 0.9,
                  maximum_interval: 36500,
                  enable_fuzz: true,
                }),
              });
            }
          },
        );

        await optimizeButton.click();

        // Wait for success message
        await expect(
          page.locator("text=Parameters optimized successfully"),
        ).toBeVisible({ timeout: 10000 });

        // Check if retention field was updated (if visible)
        const retentionInput = page.locator('input[name="requestRetention"]');
        if (await retentionInput.isVisible()) {
          await expect(retentionInput).toHaveValue("0.9");
        }

        // Check if maximum interval was updated (if visible)
        const maxIntervalInput = page.locator('input[name="maximumInterval"]');
        if (await maxIntervalInput.isVisible()) {
          await expect(maxIntervalInput).toHaveValue("36500");
        }
      }
    }
  });

  test("should disable optimize button during optimization", async ({
    page,
  }) => {
    // Select FSRS algorithm first
    const fsrsRadio = page.locator('input[type="radio"][value="FSRS"]');
    if (await fsrsRadio.isVisible()) {
      await fsrsRadio.check();

      const optimizeButton = page.locator(
        'button:has-text("Auto-Optimize Parameters")',
      );
      if (await optimizeButton.isVisible()) {
        // Mock delayed API response
        await page.route("**/preferences/optimize_fsrs*", async (route) => {
          // Delay response to test loading state
          await new Promise((resolve) => setTimeout(resolve, 2000));
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              message: "FSRS optimization completed successfully",
              user_id: 1,
              algorithm: "FSRS",
              review_count: 25,
              loss: 0.15,
              optimized_parameters: [
                0.4, 0.9, 2.3, 10.9, 4.93, 1, 0.94, 0.86, 1.01, 1.49, 0.14,
                1.74, 0, 1.46, 1.66, 0.24, 1,
              ],
              scheduler_config: {
                desired_retention: 0.9,
                maximum_interval: 36500,
                enable_fuzzing: true,
              },
            }),
          });
        });

        await optimizeButton.click();

        // Button should be disabled during optimization
        await expect(optimizeButton).toBeDisabled();

        // Wait for completion
        await expect(
          page.locator("text=Parameters optimized successfully"),
        ).toBeVisible({ timeout: 10000 });

        // Button should be enabled again
        await expect(optimizeButton).toBeEnabled();
      }
    }
  });

  test("should show tooltip or help text for optimization feature", async ({
    page,
  }) => {
    // Select FSRS algorithm first
    const fsrsRadio = page.locator('input[type="radio"][value="FSRS"]');
    if (await fsrsRadio.isVisible()) {
      await fsrsRadio.check();

      // Look for help text or tooltip near the optimize button
      const helpText = page
        .locator("text*=optimize")
        .or(
          page
            .locator("text*=automatic")
            .or(page.locator("text*=review history")),
        );

      // At least some help text should be visible
      await expect(helpText.first()).toBeVisible();
    }
  });

  test("should preserve other form values during optimization", async ({
    page,
  }) => {
    // Select FSRS algorithm first
    const fsrsRadio = page.locator('input[type="radio"][value="FSRS"]');
    if (await fsrsRadio.isVisible()) {
      await fsrsRadio.check();

      // Set some form values
      const retentionInput = page.locator('input[name="requestRetention"]');
      if (await retentionInput.isVisible()) {
        await retentionInput.fill("0.85");
      }

      const optimizeButton = page.locator(
        'button:has-text("Auto-Optimize Parameters")',
      );
      if (await optimizeButton.isVisible()) {
        // Mock optimization response
        await page.route("**/preferences/optimize_fsrs*", async (route) => {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              message: "FSRS optimization completed successfully",
              user_id: 1,
              algorithm: "FSRS",
              review_count: 25,
              loss: 0.15,
              optimized_parameters: [
                0.4, 0.9, 2.3, 10.9, 4.93, 1, 0.94, 0.86, 1.01, 1.49, 0.14,
                1.74, 0, 1.46, 1.66, 0.24, 1,
              ],
              scheduler_config: {
                desired_retention: 0.9,
                maximum_interval: 36500,
                enable_fuzzing: true,
              },
            }),
          });
        });

        await optimizeButton.click();

        // Wait for completion
        await expect(
          page.locator("text=Parameters optimized successfully"),
        ).toBeVisible({ timeout: 10000 });

        // Algorithm selection should still be FSRS
        await expect(fsrsRadio).toBeChecked();
      }
    }
  });
});

test.describe("FSRS Optimization Integration", () => {
  test("should work with real backend when available", async ({ page }) => {
    // This test will work with the actual backend
    await page.goto("/user-settings/scheduling-options");
    await page.waitForLoadState("networkidle");

    // Select FSRS algorithm
    const fsrsRadio = page.locator('input[type="radio"][value="FSRS"]');
    if (await fsrsRadio.isVisible()) {
      await fsrsRadio.check();

      const optimizeButton = page.locator(
        'button:has-text("Auto-Optimize Parameters")',
      );
      if (await optimizeButton.isVisible()) {
        // Click without mocking - test real integration
        await optimizeButton.click();

        // Wait for either success or error
        const successMessage = page.locator(
          "text=Parameters optimized successfully",
        );
        const errorMessage = page
          .locator("text*=Insufficient review history")
          .or(page.locator("text*=Error during FSRS optimization"));

        // One of these should appear
        await expect(successMessage.or(errorMessage)).toBeVisible({
          timeout: 15000,
        });
      }
    }
  });
});
