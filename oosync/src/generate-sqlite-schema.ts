// Deprecated: this file used to generate SQLite schema by transforming
// `drizzle/schema-postgres.ts` via a TypeScript AST walk.
//
// The project has switched to Postgres-catalog introspection for the generator.
// This wrapper is intentionally kept to avoid breaking old entrypoints and to
// prevent two implementations from silently diverging.
//
// Prefer `npm run codegen:schema` (or `npm run schema:sqlite:gen`).

// eslint-disable-next-line no-console
console.warn(
  "⚠️  Deprecated: oosync/src/generate-sqlite-schema.ts now delegates to oosync/src/codegen-schema.ts. Use `npm run codegen:schema`."
);

await import("./codegen-schema.ts");

/*
function replaceImports(sf: ts.SourceFile): ts.SourceFile {
  const statements: ts.Statement[] = [];

  for (const stmt of sf.statements) {
    if (!ts.isImportDeclaration(stmt)) {
      statements.push(stmt);
      continue;
    }

    const spec = stmt.moduleSpecifier;
    const moduleName = ts.isStringLiteral(spec) ? spec.text : null;

    // Drop drizzle-orm sql import (only used for check constraints, which we remove)
    if (moduleName === "drizzle-orm") {
      continue;
    }

    // Replace pg-core import with sqlite-core import
    if (moduleName === "drizzle-orm/pg-core") {
      const importClause = ts.factory.createImportClause(
        false,
        undefined,
        ts.factory.createNamedImports([
          ts.factory.createImportSpecifier(
            false,
            undefined,
            ts.factory.createIdentifier("index")
          ),
          ts.factory.createImportSpecifier(
            false,
            undefined,
            ts.factory.createIdentifier("integer")
          ),
          ts.factory.createImportSpecifier(
            false,
            undefined,
            ts.factory.createIdentifier("primaryKey")
          ),
          ts.factory.createImportSpecifier(
            false,
            undefined,
            ts.factory.createIdentifier("real")
          ),
          ts.factory.createImportSpecifier(
            false,
            undefined,
            ts.factory.createIdentifier("sqliteTable")
          ),
          ts.factory.createImportSpecifier(
            false,
            undefined,
            ts.factory.createIdentifier("text")
          ),
          ts.factory.createImportSpecifier(
            false,
            undefined,
            ts.factory.createIdentifier("uniqueIndex")
          ),
        ])
      );

      statements.push(
        ts.factory.createImportDeclaration(
          stmt.modifiers,
          importClause,
          ts.factory.createStringLiteral("drizzle-orm/sqlite-core")
        )
      );
      continue;
    }

    // Swap pgSyncColumns -> sqliteSyncColumns
    if (moduleName === "./sync-columns") {
      if (
        !stmt.importClause?.namedBindings ||
        !ts.isNamedImports(stmt.importClause.namedBindings)
      ) {
        statements.push(stmt);
        continue;
      }

      const newSpecs: ts.ImportSpecifier[] = [];
      for (const s of stmt.importClause.namedBindings.elements) {
        const imported = s.propertyName ? s.propertyName.text : s.name.text;
        const local = s.name.text;
        if (imported === "pgSyncColumns" && local === "pgSyncColumns") {
          newSpecs.push(
            ts.factory.createImportSpecifier(
              false,
              undefined,
              ts.factory.createIdentifier("sqliteSyncColumns")
            )
          );
          continue;
        }
        if (imported === "pgSyncColumns") {
          // Preserve aliasing if present.
          newSpecs.push(
            ts.factory.createImportSpecifier(
              false,
              ts.factory.createIdentifier("sqliteSyncColumns"),
              ts.factory.createIdentifier(local)
            )
          );
          continue;
        }
        newSpecs.push(s);
      }

      const importClause = ts.factory.updateImportClause(
        stmt.importClause,
        false,
        stmt.importClause.name,
        ts.factory.createNamedImports(newSpecs)
      );

      statements.push(
        ts.factory.updateImportDeclaration(
          stmt,
          stmt.modifiers,
          importClause,
          stmt.moduleSpecifier,
          stmt.attributes
        )
      );
      continue;
    }

    statements.push(stmt);
  }

  return ts.factory.updateSourceFile(sf, statements);
}

function buildUniqueIndexName(params: {
  tableName: string;
  columns: string[];
}): string {
  const parts = [params.tableName, ...params.columns, "unique"];
  return parts.filter(Boolean).join("_");
}

function transformFile(sf: ts.SourceFile): ts.SourceFile {
  // First, replace imports as needed.
  sf = replaceImports(sf);

  // General (context-free) transforms: types, defaults, sync columns, and removing checks.
  const generalTransformer: ts.TransformerFactory<ts.SourceFile> = (ctx) => {
    const v: ts.Visitor = (node) => {
      const visited = ts.visitEachChild(node, v, ctx);

      // SQLite schema builders don't support column ordering helpers like .asc()/.desc().
      // These show up primarily in index definitions.
      if (
        ts.isCallExpression(visited) &&
        ts.isPropertyAccessExpression(visited.expression) &&
        visited.arguments.length === 0
      ) {
        const orderFn = visited.expression.name.text;
        if (orderFn === "asc" || orderFn === "desc") {
          return visited.expression.expression;
        }
      }

      // Drop check(...) entries from arrays (table config lists)
      if (ts.isArrayLiteralExpression(visited)) {
        const newElements = visited.elements.filter((el) => {
          if (!ts.isCallExpression(el)) return true;
          return !isCheckCall(el);
        });
        if (newElements.length !== visited.elements.length) {
          return ts.factory.updateArrayLiteralExpression(visited, newElements);
        }
      }

      // Convert pgTable(...) -> sqliteTable(...)
      if (ts.isIdentifier(visited) && visited.text === "pgTable") {
        return ts.factory.createIdentifier("sqliteTable");
      }

      // Replace spread ...pgSyncColumns with ...sqliteSyncColumns
      if (
        ts.isSpreadAssignment(visited) &&
        ts.isIdentifier(visited.expression) &&
        visited.expression.text === "pgSyncColumns"
      ) {
        return ts.factory.updateSpreadAssignment(
          visited,
          ts.factory.createIdentifier("sqliteSyncColumns")
        );
      }

      // Convert uuid()/timestamp()/boolean() builders
      if (ts.isCallExpression(visited) && ts.isIdentifier(visited.expression)) {
        const fn = visited.expression.text;
        if (fn === "uuid" || fn === "timestamp") {
          return ts.factory.updateCallExpression(
            visited,
            ts.factory.createIdentifier("text"),
            visited.typeArguments,
            visited.arguments
          );
        }
        if (fn === "boolean") {
          return ts.factory.updateCallExpression(
            visited,
            ts.factory.createIdentifier("integer"),
            visited.typeArguments,
            visited.arguments
          );
        }
      }

      // Convert .default(true/false) -> .default(1/0)
      if (
        ts.isCallExpression(visited) &&
        ts.isPropertyAccessExpression(visited.expression)
      ) {
        if (
          visited.expression.name.text === "default" &&
          visited.arguments.length === 1
        ) {
          const arg = visited.arguments[0];
          if (
            arg &&
            (arg.kind === ts.SyntaxKind.TrueKeyword ||
              arg.kind === ts.SyntaxKind.FalseKeyword)
          ) {
            const intLiteral = ts.factory.createNumericLiteral(
              arg.kind === ts.SyntaxKind.TrueKeyword ? 1 : 0
            );
            return ts.factory.updateCallExpression(
              visited,
              visited.expression,

            export {};
            );
*/

export {};
