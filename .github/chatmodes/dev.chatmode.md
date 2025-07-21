---
description: "TuneTrees development mode - Core coding, file editing, and code analysis."
tools: ['changes', 'codebase', 'editFiles', 'extensions', 'fetch', 'findTestFiles', 'githubRepo', 'new', 'openSimpleBrowser', 'problems', 'runCommands', 'runTasks', 'runTests', 'search', 'searchResults', 'terminalLastCommand', 'terminalSelection', 'testFailure', 'usages', 'vscodeAPI', 'memory', 'create_issue', 'get_commit', 'get_issue', 'get_issue_comments', 'get_job_logs', 'get_pull_request_status', 'list_issues', 'search_issues', 'update_issue', 'update_pull_request', 'update_pull_request_branch', 'pylance mcp server' ]
---

## TuneTrees Development Mode

**Focus**: Core development work including coding, file editing, code analysis, and knowledge management.

### 🚀 **Primary Capabilities**

- **Code Search & Analysis**: Find patterns, usages, and understand codebase structure
- **File Operations**: Create, edit, and organize code files
- **Memory & Knowledge**: Build persistent understanding of TuneTrees architecture
- **Error Detection**: Identify and analyze code issues
- **Build Tasks**: Run VS Code tasks for building and development

### 🛠️ **Available Tools**

- **GitHub API**: Primary tools for repository operations:
  - `mcp_github_push_files` – Commit and push multiple files
  - `mcp_github_create_pull_request` – Create pull requests via GitHub API
  - `mcp_github_update_pull_request` – Update pull requests with new commits
  - `mcp_github_get_status` – Get repository status and recent changes
  - `mcp_github_list_commits` – List recent commits and commit details
  - `mcp_github_get_commit` – Get details for a specific commit
  - `mcp_github_list_issues` – List issues in the repository
  - `mcp_github_get_issue` – Get details for a specific issue
  - `mcp_github_create_issue` – Create a new issue
  - `mcp_github_update_issue` – Update an existing issue
  - `mcp_github_list_pull_requests` – List pull requests in the repository
  - `mcp_github_get_pull_request` – Get details for a specific pull request
  - `mcp_github_comment_pull_request` – Add comments to a pull request
- **Search**: `semantic_search`, `grep_search`, `file_search`
- **File Ops**: `read_file`, `replace_string_in_file`, `create_file`, `list_dir`
- **Code Analysis**: `list_code_usages`, `get_errors`
- **Tasks**: `run_vs_code_task`
- **Memory**: `mcp_memory_*` tools for persistent context
- **Terminal**: `run_in_terminal` for executing commands
- **Python Tools**:
  - `run_python_file` – Execute Python scripts
  - `run_python_tests` – Run Python test suites (pytest)
  - `python_lint` – Lint Python files for errors and style issues
  - `python_format` – Format Python code using Black
  - `python_type_check` – Run type checking with mypy
- **Pylance Tools**:
  - `pylance_type_check` – Perform advanced type analysis using Pylance
  - `pylance_get_diagnostics` – Retrieve Pylance diagnostics and suggestions

### 📋 **Best For**

- Implementing new features
- Refactoring code
- Understanding existing codebase
- Building knowledge about TuneTrees patterns
- Running build and development tasks
