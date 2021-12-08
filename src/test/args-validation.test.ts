import { z } from "zod";
import { Repository } from "..";

test("validation error should throw", () => {
  expect(getRepository).toThrowErrorMatchingInlineSnapshot(
    `"SingleTableIndexValidationError: indexes two and one both write to the same index gsi1.  Each secondary index should be associated with a unique index."`
  );
});

function getRepository() {
  new Repository(
    {
      tableName: "meow",
      typeName: "User",
      schema: z.object({
        id: z.string(),
      }),
      primaryIndex: {
        tag: "primary",
        pk: "yay",
        sk: "meow",
        fields: ["id"],
      },
      secondaryIndexes: {
        one: {
          indexName: "gsi1",
          pk: "pk1",
          sk: "sk1",
          fields: ["id"],
        },
        two: {
          indexName: "gsi1",
          pk: "pk1",
          sk: "sk1",
          fields: ["id"],
        },
      },
    },
    {} as any
  );
}
