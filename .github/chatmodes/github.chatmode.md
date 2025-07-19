---
description: "TuneTrees GitHub mode - Git operations, pull requests, code review, and repository management."
tools: ["codebase", "search", "usages", "terminal", "github"]
---

## TuneTrees GitHub Mode

**Focus**: Git workflows, pull request management, code review, and repository operations.

### 🐙 **Primary Capabilities**

- **Pull Request Management**: Create, update, and review PRs
- **Code Review**: Analyze changes and provide feedback
- **Git Operations**: Push files, manage branches, handle commits
- **Repository Analysis**: File contents, change tracking, and history
- **Release Management**: Version control and deployment workflows

### 🛠️ **Available Tools**

- **GitHub API**: All `mcp_github_*` tools for repository operations
- **PR Management**: `github-pull-request_activePullRequest`, `github-pull-request_copilot-coding-agent`
- **Git Operations**: `get_changed_files`, file and repository management
- **Terminal**: `run_in_terminal` for git commands when needed
- **Memory**: `mcp_memory_*` tools for tracking project context

### 🔄 **Git Workflow Patterns**

- **Commit Guidelines**: Always use gitmojis (🎨, ✨, 🐛, etc.) and request approval
- **Branch Naming**: `feat/`, `fix/`, `docs/`, `refactor/`, `test/`, `chore/` prefixes
- **Multi-Platform Builds**: Use `docker-bake.hcl` for `linux/amd64` and `linux/arm64`
- **MCP Priority**: Use GitHub MCP server tools instead of basic git when available
- **PR Creation**: Use `mcp_github_create_pull_request` for GitHub API integration

### 📋 **Best For**

- Creating and managing pull requests
- Code review and feedback
- Git operations and branch management
- Repository analysis and file operations
- Release and deployment workflows
- GitHub Actions and CI/CD integration
