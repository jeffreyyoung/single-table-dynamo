/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "jest-dynalite/environment",
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        // TS151002: ts-jest wants isolatedModules for module=node20, but that
        // would disable type-checking in tests (types.test.ts relies on it).
        diagnostics: { ignoreCodes: [151002] },
      },
    ],
  },
  setupFilesAfterEnv: [
    "jest-dynalite/setupTables",
    // Optional (but recommended)
    "jest-dynalite/clearAfterEach",
  ],
  modulePathIgnorePatterns: ["<rootDir>/dist/"],
  testTimeout: 20000,
  // Keep the pre-Jest-29 snapshot style so existing inline snapshots stay stable.
  snapshotFormat: { escapeString: true, printBasicPrototype: true },
};
