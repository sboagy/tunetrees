# Security Policy

## Supported Versions

TuneTrees is currently in active development. Security updates are provided for the latest version on the main branch.

| Version | Supported                           |
| ------- | ----------------------------------- |
| main    | :white_check_mark:                  |
| feat/\* | :construction: Development branches |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

If you discover a security vulnerability in TuneTrees, please report it privately:

### Preferred Method: GitHub Security Advisories

1. Go to https://github.com/sboagy/tunetrees/security/advisories
2. Click "Report a vulnerability"
3. Fill out the form with details about the vulnerability

### Alternative Method: Email

Contact the maintainer directly at: sboag@users.noreply.github.com

### What to Include

Please include the following information in your report:

- Type of vulnerability (e.g., XSS, SQL injection, authentication bypass)
- Full paths of source file(s) related to the vulnerability
- Location of the affected source code (tag/branch/commit or direct URL)
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the vulnerability

## Response Timeline

- **Initial Response**: Within 48 hours of report
- **Status Update**: Within 7 days with assessment of the vulnerability
- **Fix Timeline**: Critical vulnerabilities will be patched within 14 days
- **Disclosure**: After patch is released and users have had time to update

## Security Update Policy

Security patches are released as soon as they are available and announced via:

- GitHub Security Advisories
- Release notes with `[SECURITY]` tag
- Repository notifications

## Recognition

We appreciate the security community's efforts in responsibly disclosing vulnerabilities. With your permission, we will:

- Credit you in the security advisory
- Acknowledge you in release notes
- List you in our security hall of fame (if you wish)

If you prefer to remain anonymous, please let us know in your report.

## Scope

### In Scope

- Authentication and authorization issues
- Data exposure or leaks
- SQL injection vulnerabilities
- Cross-site scripting (XSS)
- Cross-site request forgery (CSRF)
- Server-side request forgery (SSRF)
- Remote code execution
- Privilege escalation

### Out of Scope

- Vulnerabilities in third-party dependencies (report to the respective maintainers)
- Issues requiring significant social engineering
- Denial of service attacks
- Issues in development dependencies that don't affect production

## Known Dev-Only Vulnerabilities (Accepted Risk)

The following vulnerabilities are present in development dependencies only and do not affect production builds:

### Accepted Vulnerabilities

| Advisory            | Package         | Severity | Reason for Acceptance                                                                              |
| ------------------- | --------------- | -------- | -------------------------------------------------------------------------------------------------- |
| GHSA-67mh-4wv8-2f99 | esbuild ≤0.24.2 | Moderate | Used by drizzle-kit (dev tool). Vulnerability only affects dev server, not production builds.      |
| GHSA-35jh-r3h4-6jhm | lodash.template | High     | Used by shadcn-solid CLI (dev tool). Only runs during component installation, not in runtime code. |

### Checking Production Security

To audit only production dependencies (excluding dev tools):

```bash
npm run audit:prod
```

## Additional Information

TuneTrees is a Progressive Web App (PWA) for practicing traditional music using spaced repetition. The application:

- Uses SolidJS for the frontend
- Stores data locally in SQLite WASM
- Syncs with Supabase for cloud backup
- Implements Supabase Auth for authentication

For general questions about security practices, please open a discussion in the repository.
