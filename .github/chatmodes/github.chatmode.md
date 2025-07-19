# TuneTrees GitHub Mode

**Focus**: Git workflows, pull request management, code review, and repository operations.

## 🛠️ **Available Tools**

```yaml
tools: ["codebase", "search", "usages", "terminal", "github"]
```

### 🐙 **Primary Capabilities**

- **Pull Request Management**: Create, update, and review PRs
- **Code Review**: Analyze changes and provide feedback
- **Git Operations**: Push files, manage branches, handle commits
- **Repository Analysis**: File contents, change tracking, and history
- **Release Management**: Version control and deployment workflows

### 📋 **Best For**

- Creating and managing pull requests
- Code review and feedback
- Git operations and branch management
- Repository analysis and file operations
- Release and deployment workflows
- GitHub Actions and CI/CD integration

### 🔄 **Git Workflow Patterns**

- **Commit Guidelines**: Always use gitmojis (🎨, ✨, 🐛, etc.) and request approval
- **Branch Naming**: `feat/`, `fix/`, `docs/`, `refactor/`, `test/`, `chore/` prefixes
- **Multi-Platform Builds**: Use `docker-bake.hcl` for `linux/amd64` and `linux/arm64`
- **MCP Priority**: Use GitHub MCP server tools instead of basic git when available
- **PR Creation**: Use `mcp_github_create_pull_request` for GitHub API integration

### 🚫 **Not Included**

- Pure development work (use Dev mode)
- Testing and debugging (use Test-Debug mode)

### 🎯 **Workflow Focus**

Specialized for repository management, code collaboration, and release workflows with comprehensive GitHub integration and proper git hygiene.