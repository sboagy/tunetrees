# Testing Guide

This document explains how to run tests in the TuneTrees monorepo.

## Backend Tests (Python/FastAPI/pytest)

### Quick Start

```bash
# From project root - recommended approach
pytest tests/ -v

# Alternative: Use the clean test runner script
python run_tests.py
```

### Test Structure

- Backend tests are located in `tests/`
- Test configuration is in `pyproject.toml`
- Test fixtures and database setup are in `tests/conftest.py`
- Tests use FastAPI TestClient for API testing
- Each test gets a fresh copy of the test database

### Test Database

- Clean test database: `tunetrees_test_clean.sqlite3`
- Working test database: `tunetrees_test.sqlite3` (auto-reset before each test)
- Reset clean test DB: `cp tunetrees_test_clean.sqlite3 tunetrees_test.sqlite3`

## Frontend Tests (Playwright/Node.js)

### Quick Start

```bash
# From frontend directory
cd frontend
npm test                    # Run Playwright tests
npx playwright test         # Alternative
npx playwright test --ui    # Interactive UI mode
```

### Test Structure

- Frontend tests are in `frontend/tests/`
- Playwright configuration is in `frontend/playwright.config.ts`
- Package configuration is in `frontend/package.json`

## VS Code Tasks

You can use the built-in VS Code tasks:

- `clean_test_db`: Reset the test database
- `start_server`: Start the FastAPI development server
- `stop_server`: Stop the FastAPI development server

## Test Isolation

- **Backend tests**: Run independently, use TestClient (no server needed)
- **Frontend tests**: May use either TestClient or live server depending on configuration
- Tests can be run simultaneously without interference

## Troubleshooting

### Backend Threading Warnings

If you see threading-related warnings at the end of backend test runs, this is a harmless Python interpreter shutdown artifact and doesn't affect test results.

### Playwright Version Prompts

Playwright may prompt for updates periodically. This is normal and unrelated to backend Python tests.

### Database Issues

If tests fail with database errors, try resetting the test database:

```bash
cp tunetrees_test_clean.sqlite3 tunetrees_test.sqlite3
```
