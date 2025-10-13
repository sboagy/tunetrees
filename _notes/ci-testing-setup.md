Setting up your CI testing requires essentially transplanting your successful local workflow into the GitHub Actions runner, ensuring two things: **Docker is running**, and the **Supabase CLI has the keys to start it.**

Here is a brief, high-level overview of how to set up your CI testing in a GitHub Action.

---

## 🤖 CI Setup for Supabase Testing

The general workflow involves three main steps in your GitHub Actions YAML file, typically run before your main test command:

### 1\. Prerequisites (Checkout & Setup)

You need to ensure the runner has all the necessary tools and your code.

- **Setup Node:** Install the correct version of Node.js.
- **Checkout Code:** Get your source code, including the `supabase/` folder with your migrations and the `supabase/seed.sql` file.
- **Install Supabase CLI:** The runner needs the CLI to manage the local stack.

<!-- end list -->

```yaml
- name: Checkout code
  uses: actions/checkout@v4

- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: "20"

- name: Install Supabase CLI
  run: npm install -g supabase
```

### 2\. Start the Local Supabase Stack

This is the most crucial step. The GitHub runner has Docker pre-installed, so you just tell the Supabase CLI to start the stack.

- **Action:** Run `supabase start`. This launches the Dockerized Postgres database and all other services locally, exposing the database on `localhost:54322`.

<!-- end list -->

```yaml
- name: Start Supabase Local Stack
  run: supabase start
```

### 3\. Reset and Reseed the Database

You use the exact same command you perfected locally to create the clean test environment.

- **Action:** Run `supabase db reset`. This command finds your schema migrations (in `supabase/migrations`) and your clean data snapshot (in `supabase/seed.sql`) and applies them to the local Docker database.

<!-- end list -->

```yaml
- name: Reset and Seed Database
  run: supabase db reset
```

### 4\. Run Tests

Finally, you execute your application's test command. Your application's environment variables must be configured to use the local services (e.g., `DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres`).

```yaml
- name: Run Integration Tests
  run: npm run test:ci # Or whatever command runs your integration tests
  env:
    # Pass the local Supabase URLs to your test runner
    DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
    SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_LOCAL_SECRET_KEY }} # Use a dummy secret here
```

By following this flow, your CI job achieves a guaranteed clean state before every test run.
