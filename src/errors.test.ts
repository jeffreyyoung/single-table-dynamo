import { STDError } from "./utils/errors";

test("std error serializes properly", () => {
  const err = new Error("test error");
  const stdErr = new STDError({
    name: "single-table-Error",
    message: "test error",
    cause: err,
    meta: {
      id: { foo: "bar" },
    },
  });

  expect(JSON.parse(JSON.stringify(stdErr))).toMatchObject({
    cause: {}, // todo - maybe make cause more serializable?
    message: "test error",
    meta: {
      id: {
        foo: "bar",
      },
    },
    name: "single-table-Error",
  });
});
