#!/bin/bash

# Simple script to load .env.local and run playwright tests

cp ../tunetrees_test_clean.sqlite3 ../tunetrees_test.sqlite3

# Load environment variables from .env.local using dotenv CLI if available, else fallback to manual export
dotenv -f .env.local run npx playwright test "$@"

