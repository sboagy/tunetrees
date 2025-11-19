# E2E Tests for Tune Editor and Importer (PR #289)

This directory contains end-to-end tests for the tune editor and tune importer features introduced in PR #289.

## Test Files

### 1. `tune-editor-001-edit-tune.spec.ts`
**Priority:** Critical  
**Tests:** Editing existing tunes

**Test Cases:**
- ✅ Open tune editor and cancel without saving changes
- ✅ Edit tune title and save changes
- ✅ Edit multiple tune fields and save
- ✅ Handle tune override for public tunes (creates override instead of modifying original)

**Key Behaviors Tested:**
- Cancel workflow preserves original data
- Save workflow persists changes to database
- Changes appear correctly in catalog grid after save
- Public tune edits create `tune_override` records (not direct tune modifications)

### 2. `tune-editor-002-create-tune.spec.ts`
**Priority:** Critical  
**Tests:** Creating new tunes

**Test Cases:**
- ✅ Create new tune with minimal fields (title only)
- ✅ Create new tune with all fields populated
- ✅ Create new tune with title pre-filled from dialog
- ✅ Cancel new tune creation (tune not saved)

**Key Behaviors Tested:**
- "Add Tune" dialog opens correctly
- "New" button navigates to empty tune editor
- Title can be pre-filled from Add Tune dialog
- All tune fields (title, type, mode, structure, incipit) can be populated
- New tunes appear in catalog after save
- Cancel prevents tune creation

### 3. `tune-editor-003-show-public-toggle.spec.ts`
**Priority:** High  
**Tests:** Show Public toggle functionality

**Test Cases:**
- ✅ Show Public toggle exists and is visible in tune editor
- ✅ Toggle makes form read-only when enabled
- ✅ Toggle displays original tune data (without overrides) when enabled
- ✅ Toggle is hidden for new tunes (only shows for existing tunes)

**Key Behaviors Tested:**
- Toggle is OFF by default
- When ON: form becomes read-only and shows original public tune data
- When OFF: form is editable and shows user's override values
- Info banner appears when toggle is ON
- Toggle switches seamlessly between public and override data
- New tune creation doesn't show the toggle

### 4. `tune-import-001-thesession.spec.ts`
**Priority:** High  
**Tests:** Importing tunes from TheSession.org

**⚠️ IMPORTANT:** These tests require real network access to thesession.org and are **SKIPPED by default** in CI.

**To run locally:**
```bash
ENABLE_IMPORT_TESTS=true npx playwright test tune-import-001
```

**Test Cases:**
- ✅ Import tune by direct URL with single setting
- ✅ Import tune by direct URL with multiple settings (user selection)
- ✅ Search by title and select from multiple results
- ✅ Handle invalid URL gracefully (error message shown)
- ✅ Handle search with no results (error message shown)

**Key Behaviors Tested:**
- Direct URL import navigates to tune editor with populated fields
- Multiple settings trigger setting selection dialog
- Search by title shows tune selection dialog for multiple results
- Single search result imports directly
- Imported data includes: title, type, mode, structure, incipit, ABC notation
- Error messages displayed for failed imports
- Imported tunes save correctly to catalog

## Running Tests

### Run All New Tests
```bash
# Run tune editor tests only
npx playwright test tune-editor

# Run create tests only
npx playwright test tune-editor-002

# Run edit tests only
npx playwright test tune-editor-001

# Run Show Public toggle tests
npx playwright test tune-editor-003

# Run import tests (requires network)
ENABLE_IMPORT_TESTS=true npx playwright test tune-import-001
```

### Run with UI Mode (Interactive)
```bash
npx playwright test --ui
```

### Run in Headed Mode (See Browser)
```bash
npx playwright test tune-editor --headed
```

### Debug Mode
```bash
npx playwright test tune-editor --debug
```

## Test Structure

All tests follow the established TuneTrees testing patterns:

```typescript
import { expect } from "@playwright/test";
import { setupDeterministicTestParallel } from "../helpers/practice-scenarios";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

let ttPage: TuneTreesPage;

test.describe("FEATURE-NNN: Test Suite Name", () => {
  test.beforeEach(async ({ page, testUser }) => {
    ttPage = new TuneTreesPage(page);
    
    // Start with clean repertoire
    await setupDeterministicTestParallel(page, testUser, {
      clearRepertoire: true,
      seedRepertoire: [],
    });
    
    // Navigate to starting tab
    await ttPage.catalogTab.click();
    await expect(ttPage.catalogGrid).toBeVisible({ timeout: 10000 });
  });

  test("should do something", async ({ page }) => {
    // ARRANGE: Set up test state
    // ACT: Perform user action
    // ASSERT: Verify expected outcome
  });
});
```

## Key Testing Principles

1. **Single Input State:** No conditional branches in test code
2. **Resilient Timeouts:** All visibility checks use explicit 5-10 second timeouts
3. **DRY with Page Objects:** Use `TuneTreesPage` for all locators
4. **Network Waits:** Use `page.waitForLoadState("networkidle")` after mutations
5. **Parallel Safety:** Each test starts with `setupDeterministicTestParallel`

## Data-Testid Selectors Added

The following data-testids were added to support these tests:

### TuneEditor Component (`src/components/tunes/TuneEditor.tsx`)
- `tune-editor-form` - Main form container
- `tune-editor-save-button` - Save button (edit mode)
- `tune-editor-cancel-button` - Cancel button (edit mode)
- `tune-editor-edit-button` - Edit button (read-only mode)
- `show-public-toggle` - Toggle switch for showing public tune data vs user overrides

### Sidebar Component (`src/components/sidebar/TuneInfoHeader.tsx`)
- `sidebar-edit-tune-button` - Edit button next to tune title in sidebar

### AddTuneDialog Component (`src/components/import/AddTuneDialog.tsx`)
- `addtune-url-or-title-input` - URL or title input field

### Existing Locators Used
- `catalog-add-tune-button` - "Add Tune" toolbar button
- `tunes-grid-catalog` - Catalog grid container

## Import Test Configuration

Import tests are disabled by default to avoid CI failures due to:
- Network flakiness
- Rate limiting from external services
- Service availability issues

To enable in CI, set GitHub Actions secret:
```yaml
env:
  ENABLE_IMPORT_TESTS: 'true'
```

## Future Enhancements

### Additional Test Coverage Needed
- [ ] Import from irishtune.info (when implemented)
- [ ] Import with ABC notation preview
- [ ] Tag editing in tune editor
- [ ] Private notes editing
- [ ] Advanced FSRS/SM2 fields (if expanded section)
- [ ] Mobile viewport testing (responsive behavior)
- [ ] Keyboard navigation (accessibility)

### Mock Import Services (Alternative Approach)
Instead of real network calls, could create mock responses:

```typescript
// Intercept thesession.org API calls
await page.route('**/api.thesession.org/**', route => {
  route.fulfill({
    status: 200,
    body: JSON.stringify({
      name: "Mock Tune",
      type: "jig",
      settings: [{ abc: "X:1\nT:Mock Tune\nM:6/8\nK:D\nDEF GAB|", key: "D" }]
    })
  });
});
```

This would:
- ✅ Work in CI without network
- ✅ Be faster and more reliable
- ✅ Allow testing edge cases
- ❌ Not test real API integration
- ❌ Require maintenance if API changes

**Decision:** Start with real services (skipped in CI), add mocks if needed.

## Troubleshooting

### Tests Fail with "Button not visible"
- **Cause:** Navigation or dialog not opened yet
- **Fix:** Add `await page.waitForLoadState("networkidle")` before assertions

### Import Tests Always Skipped
- **Cause:** `ENABLE_IMPORT_TESTS` not set
- **Fix:** Run with `ENABLE_IMPORT_TESTS=true npx playwright test tune-import-001`

### "Tune not found in catalog" After Save
- **Cause:** Sync not complete or search filter issue
- **Fix:** Add `await page.waitForTimeout(500)` after search input

### Flaky Tests in CI
- **Cause:** Timing issues with animations or async operations
- **Fix:** Increase timeouts from 5s to 10s for critical assertions

## Contributing

When adding new tests:

1. Follow naming convention: `<feature>-<number>-<description>.spec.ts`
2. Use `test` fixture from `helpers/test-fixture.ts` for parallel safety
3. Start each test with `setupDeterministicTestParallel`
4. Add appropriate data-testids to components
5. Update this README with new test cases
6. Ensure tests pass locally before committing

## References

- **Testing Guidelines:** `.github/instructions/testing.instructions.md`
- **Page Objects:** `e2e/page-objects/TuneTreesPage.ts`
- **Test Helpers:** `e2e/helpers/practice-scenarios.ts`
- **Legacy Tests:** `legacy/frontend/tests/test-edit-1.spec.ts` (React version)
