import { FlatCompat } from "@eslint/eslintrc";
import js from "@eslint/js";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import react from "eslint-plugin-react";
import unicorn from "eslint-plugin-unicorn";
import path from "node:path";
import { fileURLToPath } from "node:url";

// eslint-disable-next-line @typescript-eslint/naming-convention
const __filename = fileURLToPath(import.meta.url);
// eslint-disable-next-line @typescript-eslint/naming-convention
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default [
  {
    ignores: [
      "**/build/",
      "node_modules/next-auth-http-adapter",
      "**/node_modules/",
      "**/.next/",
      ".next/*",
      ".next/cache/",
      "**/archive/",
      "components/ui/button.tsx",
      "components/ui/form.tsx",
      "**/images.d.ts",
      "**/postcss.config.mjs",
      "**/middleware.ts",
      "**/tailwind.config.mjs",
      "**/next.config.js",
      "**/next.config.mjs",
      ".prettierrc.js",
    ],
  },
  ...compat.extends(
    "./node_modules/gts/",
    "eslint:recommended",
    "plugin:@typescript-eslint/eslint-recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/jsx-runtime",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
    "plugin:unicorn/recommended",
  ),
  {
    plugins: {
      "@typescript-eslint": typescriptEslint,
      react,
      unicorn,
    },

    languageOptions: {
      parser: tsParser,
      ecmaVersion: "latest",
      sourceType: "module",

      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },

        project: "./tsconfig.json",
      },
    },

    settings: {
      react: {
        version: "detect",
      },
    },

    rules: {
      "unicorn/consistent-existence-index-check": "off",
      "unicorn/prefer-global-this": "off",
      "n/no-deprecated-api": "off",
      "n/no-extraneous-require": "off",
      "n/no-unpublished-require": "off",
      "n/no-unsupported-features/es-builtins": "off",
      "n/no-unsupported-features/node-builtins": "off",
      "n/no-exports-assign": "off",
      "n/no-missing-require": "off",
      "n/no-unsupported-features/es-syntax": "off",
      "unicorn/filename-case": [
        "error",
        {
          cases: {
            kebabCase: true,
          },

          ignore: ["layout.tsx", "page.tsx"],
        },
      ],

      "unicorn/no-empty-file": "off",
      "unicorn/prefer-module": "off",
      "unicorn/no-null": "off",
      "unicorn/numeric-separators-style": "off",
      "unicorn/switch-case-braces": "off",
      "unicorn/no-negated-condition": "off",
      "unicorn/catch-error-name": "error",
      "unicorn/consistent-function-scoping": "off",
      "unicorn/custom-error-definition": "off",
      "unicorn/error-message": "error",
      "unicorn/escape-case": "error",
      "unicorn/expiring-todo-comments": "error",
      "unicorn/explicit-length-check": "error",
      "unicorn/new-for-builtins": "off",
      "unicorn/no-abusive-eslint-disable": "error",
      "unicorn/no-console-spaces": "off",
      "unicorn/no-for-loop": "error",
      "unicorn/no-hex-escape": "error",
      "unicorn/no-keyword-prefix": "off",
      "no-nested-ternary": "off",
      "unicorn/no-nested-ternary": "off",
      "unicorn/no-new-buffer": "error",
      "unicorn/no-process-exit": "error",
      "unicorn/no-unreadable-array-destructuring": "error",
      "unicorn/no-unused-properties": "off",
      "unicorn/no-zero-fractions": "error",
      "unicorn/number-literal-case": "error",
      "unicorn/prefer-add-event-listener": "error",
      "unicorn/prefer-includes": "error",
      "unicorn/prefer-query-selector": "error",
      "unicorn/prefer-reflect-apply": "error",
      "unicorn/prefer-spread": "error",
      "unicorn/prefer-type-error": "error",
      "unicorn/prevent-abbreviations": "off",
      "unicorn/throw-new-error": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-redundant-type-constituents": "off",
      "@typescript-eslint/no-unsafe-argument": "off",

      "@typescript-eslint/naming-convention": [
        "warn",
        {
          selector: "variable",
          format: ["camelCase"],
          leadingUnderscore: "allow",
        },
        {
          selector: "variable",
          types: ["function"],
          format: ["camelCase", "PascalCase"],

          filter: {
            regex: "^[A-Z]",
            match: true,
          },
        },
        {
          selector: "typeLike",
          format: ["PascalCase"],
        },
        {
          selector: "typeParameter",
          format: ["PascalCase"],
          prefix: ["T", "K"],
        },
        {
          selector: "enumMember",
          format: ["UPPER_CASE"],
        },
        {
          selector: "interface",
          format: ["PascalCase"],
          prefix: ["I"],
        },
        {
          selector: ["variable"],
          modifiers: ["global"],
          types: ["boolean", "string", "number", "function", "array"],
          format: ["UPPER_CASE"],

          filter: {
            regex: "^[A-Z_]+$",
            match: true,
          },
        },
      ],

      quotes: "off",
    },
  },
  {
    files: [
      "components/*.tsx",
      "app/(main)/pages/practice/components/**/*.tsx",
    ],

    rules: {
      "unicorn/filename-case": [
        "error",
        {
          cases: {
            pascalCase: true,
          },

          ignore: ["Sidebar.tsx"],
        },
      ],
    },
  },
];
