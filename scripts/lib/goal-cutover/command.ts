/** Explicit write opt-in; no environment value can accidentally enable --apply. */
export function goalMigrationOptions(args: readonly string[]) {
  if (
    args.some((arg) => !["--local", "--apply"].includes(arg)) ||
    new Set(args).size !== args.length
  ) {
    throw new Error("Usage: goals:migrate [--local] [--apply]");
  }
  return { local: args.includes("--local"), apply: args.includes("--apply") };
}

export function goalMigrationConnection(local: boolean, databaseUrl?: string) {
  const connection = local
    ? "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
    : databaseUrl;
  if (!connection)
    throw new Error(
      "DATABASE_URL is required; use --local for the local database"
    );
  let url: URL;
  try {
    url = new URL(connection);
  } catch {
    throw new Error("DATABASE_URL is invalid");
  }
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !url.hostname ||
    url.pathname.length < 2
  ) {
    throw new Error("DATABASE_URL must identify a PostgreSQL database");
  }
  // Postgres.js accepts endpoint overrides in query parameters. Reject them so
  // the operator sees the endpoint that --apply actually uses.
  const endpointOptions = [
    "host",
    "hostname",
    "port",
    "database",
    "db",
    "path",
  ];
  if (endpointOptions.some((key) => url.searchParams.has(key))) {
    throw new Error(
      "DATABASE_URL must specify its endpoint only in the URL authority and path"
    );
  }
  // An omitted port otherwise inherits PGPORT, which is absent from the label.
  if (!url.port) url.port = "5432";
  return { connection: url.toString(), target: `${url.host}${url.pathname}` };
}
