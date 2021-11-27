module.exports = {
  preset: "ts-jest",
  testEnvironment: "jest-dynalite/environment",
  setupFilesAfterEnv: [
    "jest-dynalite/setupTables",
    // Optional (but recommended)
    "jest-dynalite/clearAfterEach",
  ],

  //preset: "jest-dynalite"
};
