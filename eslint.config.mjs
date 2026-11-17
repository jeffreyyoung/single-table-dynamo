// @ts-check
import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig(
  { ignores: ["dist/", "node_modules/", "**/*.js", "**/*.mjs", "example/"] },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "prefer-const": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",
      // typescript-eslint v5 reported these as warnings; keep that behavior.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
      // Core rule; does not understand type-only usage (`typeof x`).
      "no-useless-assignment": "off",
    },
  }
);
