# TuneTrees Test & Debug Mode

**Focus**: Testing, debugging, and quality assurance with tools for comprehensive application validation.

## 🛠️ **Available Tools**

```yaml
tools: ["codebase", "search", "usages", "terminal", "playwright"]
```

### 🧪 **Primary Capabilities**

- **E2E Testing**: Playwright test automation and debugging
- **Terminal Access**: Run test commands, build scripts, and debugging tools
- **Code Analysis**: Understand test structure and implementation details
- **Test Debugging**: Investigate test failures and flaky behavior
- **Quality Assurance**: Validate functionality across the application

### 📋 **Best For**

- Writing and debugging Playwright E2E tests
- Running test suites and investigating failures
- Performance analysis and profiling
- Database operations and validation
- Build system debugging and optimization
- Environment setup and configuration

### 🔧 **Test Environment Setup**

- Always use `./run-playwright-tests.sh` for proper environment initialization
- Include `restartBackend()` in test cleanup procedures
- Use Page Objects from `frontend/test-scripts/` for consistent test patterns
- Follow defensive testing with element visibility checks

### 🚫 **Not Included**

- GitHub operations (use GitHub mode)
- Pure development work (use Dev mode)

### 🎯 **Workflow Focus**

Optimized for ensuring TuneTrees quality through comprehensive testing, debugging complex issues, and maintaining robust CI/CD pipelines.