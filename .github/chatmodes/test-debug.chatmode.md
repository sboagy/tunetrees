---
description: "TuneTrees testing and debugging mode - Playwright E2E tests, backend tests, and debugging workflows."
tools: ["codebase", "search", "usages", "terminal", "playwright"]
---

## TuneTrees Test & Debug Mode

**Focus**: Testing, debugging, error analysis, and quality assurance workflows.

### 🧪 **Primary Capabilities**

- **E2E Testing**: Full Playwright browser automation and test execution
- **Backend Testing**: pytest execution and test analysis
- **Error Debugging**: Code error analysis and troubleshooting
- **Browser Automation**: Interactive debugging with Playwright tools
- **Test Environment**: Database management and test isolation

### 🛠️ **Available Tools**

- **Testing**: `run_tests`, `test_search`, `test_failure`, `get_errors`
- **Playwright**: All `mcp_playwright_browser_*` tools for browser automation
- **Terminal**: `run_in_terminal`, `get_terminal_output` for test execution
- **Tasks**: `run_vs_code_task` for test-related VS Code tasks
- **Debugging**: `get_task_output`, error analysis tools

### 🎯 **Key Testing Patterns**

- **E2E Test Setup**: Always use `./run-playwright-tests.sh` script (never direct `npx playwright test`)
- **Storage State**: Use `getStorageState("STORAGE_STATE_TEST1")` for authenticated tests
- **Test Cleanup**: Always include `restartBackend()` in `afterEach` hooks
- **Page Readiness**: Use `page.waitForLoadState("domcontentloaded")` for timing
- **Backend Tests**: Run with `pytest tests/` for backend validation

### 📋 **Best For**

- Running and debugging Playwright E2E tests
- Backend pytest validation
- Browser automation and testing
- Debugging test failures
- Test environment management
- Quality assurance workflows
