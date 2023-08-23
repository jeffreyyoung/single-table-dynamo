import { Repository } from "../repository";
import { z } from "zod";
import { getDocumentClient } from "./utils/getDocumentClient";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
const ddb = getDocumentClient();
const getUserRepo = () =>
  new Repository({
    tableName: "table1",
    typeName: "User",
    schema: z.object({
      id: z.string(),
      followers: z.array(z.string()),
      country: z.string(),
      city: z.string(),
      state: z.string().nullable(),
    }),
    primaryIndex: {
      tag: "primary",
      pk: "pk1",
      sk: "sk1",
      fields: ["id"],
    },
    secondaryIndexes: {
      byCountryByStateByCity: {
        pk: "pk2",
        sk: "sk2",
        fields: ["country", "state", "city"],
        indexName: "gsi1",
      },
    },
    documentClient: ddb,
  });

function rawPut(obj: { id: string } & any) {
  const repo = getUserRepo();
  return ddb.send(
    new PutCommand({
      TableName: repo.args.tableName,
      Item: {
        ...obj,
        ...repo.getKey(obj),
      },
    })
  );
}

test("put should work with null values", async () => {
  expect(
    await getUserRepo().put({
      id: "meow",
      country: "usa",
      city: "richland",
      state: null,
      followers: [],
    })
  ).toMatchInlineSnapshot(`
Object {
  "city": "richland",
  "country": "usa",
  "followers": Array [],
  "id": "meow",
  "state": null,
}
`);

  expect(await getUserRepo().get({ id: "meow" })).toMatchInlineSnapshot(`
Object {
  "city": "richland",
  "country": "usa",
  "followers": Array [],
  "id": "meow",
  "state": null,
}
`);
});

test("output error should be thrown", async () => {
  await rawPut({ id: "meow", invalidField: "wat" });
  expect(getUserRepo().get({ id: "meow" })).rejects.toMatchObject({
    message: `Unable to parse User output`,
    name: "single-table-OutputValidationError",
    cause: {
      issues: [
        {
          code: "invalid_type",
          expected: "array",
          received: "undefined",
          path: ["followers"],
          message: "Required",
        },
        {
          code: "invalid_type",
          expected: "string",
          received: "undefined",
          path: ["country"],
          message: "Required",
        },
        {
          code: "invalid_type",
          expected: "string",
          received: "undefined",
          path: ["city"],
          message: "Required",
        },
        {
          code: "invalid_type",
          expected: "string",
          received: "undefined",
          path: ["state"],
          message: "Required",
        },
      ],
    },
  });
});
