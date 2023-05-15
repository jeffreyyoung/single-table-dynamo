module.exports = {
  preset: "ts-jest",
  testEnvironment: "jest-dynalite/environment",
  setupFilesAfterEnv: [
    "jest-dynalite/setupTables",
    // Optional (but recommended)
    "jest-dynalite/clearAfterEach",
  ],
  modulePathIgnorePatterns: ["<rootDir>/dist/"],
  testTimeout: 20000,
  //preset: "jest-dynalite"
};
