# Environment Setup Guide

## Quick Start

### 1. Create Supabase Project

1. Go to [https://app.supabase.com](https://app.supabase.com)
2. Click "New Project"
3. Fill in:
   - **Name:** `tunetrees` (or your preference)
   - **Database Password:** Choose a strong password (save this!)
   - **Region:** Choose closest to you
4. Wait for project to finish setting up (~2 minutes)

### 2. Get Supabase Credentials

Once your project is ready:

#### Get API Keys:

1. Go to **Settings** → **API**
2. Copy the following:
   - **Project URL** (e.g., `https://abcdefghijklmnop.supabase.co`)
   - **anon public** key (under "Project API keys")
   - **service_role** key (under "Project API keys") - keep this secret!

#### Get Database URL:

1. Go to **Settings** → **Database**
2. Scroll down to **Connection pooling configuration** section
3. Look for **Connection string** (or click "Connect" button and choose "Connection Pooling")
4. Copy the URI connection string
5. Replace `[YOUR-PASSWORD]` with your database password from step 1

It will look like:

```
postgresql://postgres.abcdefghijklmnop:YOUR_PASSWORD@aws-0-us-west-1.pooler.supabase.com:6543/postgres
```

**Alternative method:**

1. Click the **Connect** button (top right of Database Settings)
2. Choose **Connection Pooling** tab
3. Select **URI** format
4. Copy the string and replace `[YOUR-PASSWORD]`

### 3. Update Your `.env` File

Open your `.env` file and add/update these variables:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_public_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
DATABASE_URL=postgresql://postgres.abcdefghijklmnop:YOUR_PASSWORD@aws-0-us-west-1.pooler.supabase.com:6543/postgres

# Legacy database path (for migration)
TUNETREES_DB=./tunetrees_test.sqlite3

# Python settings (for legacy scripts)
PYTHONPATH=.
GITHUB_REPO=tunetrees
```

### 4. Verify Setup

Test your connection:

```bash
# This should connect without errors
npx drizzle-kit push
```

If successful, you'll see:

```
✓ Connected to database
✓ Pushing schema to database...
```

---

## What Each Variable Does

### Required for SolidJS PWA:

| Variable                 | Purpose               | Where to Use              |
| ------------------------ | --------------------- | ------------------------- |
| `VITE_SUPABASE_URL`      | Supabase project URL  | Client-side (SolidJS app) |
| `VITE_SUPABASE_ANON_KEY` | Public API key        | Client-side (SolidJS app) |
| `DATABASE_URL`           | PostgreSQL connection | Drizzle Kit migrations    |

### Optional (but useful):

| Variable                    | Purpose            | When Needed                    |
| --------------------------- | ------------------ | ------------------------------ |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin API key      | Data migration, server scripts |
| `TUNETREES_DB`              | Legacy SQLite path | Migration scripts              |

---

## Security Notes

### ✅ Safe to Expose (Client-Side):

- `VITE_SUPABASE_URL` - Public project URL
- `VITE_SUPABASE_ANON_KEY` - Public anon key (has RLS protection)

Variables prefixed with `VITE_` are bundled into your client code by Vite.

### 🔒 Keep Secret (Server-Side Only):

- `SUPABASE_SERVICE_ROLE_KEY` - Bypasses Row Level Security!
- `DATABASE_URL` - Contains database password

**NEVER** commit your `.env` file or expose these secrets in client code!

---

## File Structure

You should have:

```
tunetrees/
├── .env.example        # Template (safe to commit)
├── .env                # Your actual values (in .gitignore)
├── .env.local          # Your existing local config
└── .gitignore          # Contains .env
```

### Should You Use `.env` or `.env.local`?

**Recommendation: Use `.env`**

Vite loads environment files in this order:

1. `.env` (all environments)
2. `.env.local` (all environments, ignored by git)
3. `.env.[mode]` (e.g., `.env.development`)
4. `.env.[mode].local`

Since you're starting fresh with Supabase, I recommend:

- **Use `.env`** for your new Supabase credentials
- Keep `.env.local` if it has other local overrides
- Make sure `.env` is in `.gitignore`

Or, if you prefer to keep everything in `.env.local`:

- Copy the variables from `.env.example` to your `.env.local`
- Delete `.env` (optional)

---

## Next Steps After Setup

Once your `.env` is configured:

1. **Push schema to Supabase:**

   ```bash
   npx drizzle-kit push
   ```

2. **Open Drizzle Studio to view your database:**

   ```bash
   npx drizzle-kit studio
   ```

3. **Configure Supabase Auth:**

   - Go to **Authentication** → **Providers** in Supabase dashboard
   - Enable Email/Password
   - Enable Google OAuth (use existing credentials from `.env`)
   - Enable GitHub OAuth (use existing credentials from `.env`)

4. **Test authentication in your app**

---

## Troubleshooting

### Error: "Failed to connect to database"

**Check:**

1. DATABASE_URL is correct
2. Password doesn't have special characters that need escaping
3. You're using the connection pooler URL (port 6543), not direct connection (port 5432)

**Fix:** Use the "Connection Pooling" URL from Supabase dashboard

### Error: "Invalid API key"

**Check:**

1. VITE_SUPABASE_URL matches your project
2. VITE_SUPABASE_ANON_KEY is the `anon` key, not the `service_role` key
3. No extra spaces or quotes in `.env` file

### Error: "Could not load .env file"

**Check:**

1. `.env` file is in project root (next to `package.json`)
2. File is named exactly `.env` (not `.env.txt`)
3. Restart your dev server after changing `.env`

---

## Example `.env` File

```bash
# Supabase - Replace with your actual values
VITE_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTY0NjE1MjAwMCwiZXhwIjoxOTYxNzI4MDAwfQ.example
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNjQ2MTUyMDAwLCJleHAiOjE5NjE3MjgwMDB9.example
DATABASE_URL=postgresql://postgres.abcdefghijklmnop:your_password@aws-0-us-west-1.pooler.supabase.com:6543/postgres

# Legacy
TUNETREES_DB=./tunetrees_test.sqlite3
PYTHONPATH=.
GITHUB_REPO=tunetrees
```

---

**Ready?** Follow steps 1-3 above to get started! 🚀
