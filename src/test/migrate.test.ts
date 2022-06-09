import { InferObjectType, Repository } from "../repository";
import { getDocumentClient } from "./utils/getDocumentClient";
import { z } from "zod";

const getUserRepo = () =>
  new Repository(
    {
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
    },
    getDocumentClient()
  );

function rawPut(
  obj: { id: string } & Partial<InferObjectType<ReturnType<typeof getUserRepo>>>
) {
  const repo = getUserRepo();
  return getDocumentClient()
    .put({
      TableName: repo.args.tableName,
      Item: {
        ...obj,
        ...repo.getKey(obj),
      },
    })
    .promise();
}

test.only("migrate should work for query", async () => {
  const repo = getUserRepo();
  await rawPut({
    id: "meh",
    country: "usa",
    followers: [],
  });

  // todo: handle migrations in queries
  expect(
    repo
      .query("primary")
      .where({
        id: "meh",
      })
      .exec()
      .then((res) => res.Items)
  ).resolves.toMatchInlineSnapshot(`
Array [
  Object {
    "country": "usa",
    "followers": Array [],
    "id": "meh",
  },
]
`);
});

test("migrate should work when getting full object", async () => {
  const repo = getUserRepo();
  await rawPut({
    id: "meh",
    country: "usa",
    followers: [],
  });
  await expect(() => repo.get({ id: "meh" })).rejects.toMatchInlineSnapshot(
    `[single-table-OutputValidationError: Invalid data for User is stored in the database]`
  );

  // define migrate function
  repo.args.migrate = (rawObject: any) => {
    const next: InferObjectType<typeof repo> = { ...rawObject };
    if (!rawObject.city) {
      next.city = rawObject.id + "-city";
    }
    if (!rawObject.state) {
      next.state = rawObject.id + "-state";
    }
    return repo.put(next);
  };
  const spy = jest.spyOn(repo.args, "migrate");

  await expect(repo.get({ id: "meh" }, { fieldsToProject: ["id", "country"] }))
    .resolves.toMatchInlineSnapshot(`
Object {
  "country": "usa",
  "id": "meh",
}
`);
  // since we're not getting any of the missing fields,
  // migrate should not be called
  expect(spy).toHaveBeenCalledTimes(0);

  await expect(repo.get({ id: "meh" })).resolves.toMatchInlineSnapshot(`
Object {
  "city": "meh-city",
  "country": "usa",
  "followers": Array [],
  "id": "meh",
  "state": "meh-state",
}
`);
  expect(spy).toHaveBeenCalledTimes(1);

  await expect(repo.get({ id: "meh" })).resolves.toMatchInlineSnapshot(`
  Object {
    "city": "meh-city",
    "country": "usa",
    "followers": Array [],
    "id": "meh",
    "state": "meh-state",
  }
  `);
  // migrate should only be called on first get
  expect(spy).toHaveBeenCalledTimes(1);
});

test("migrate should work when getting partial object", async () => {
  const repo = getUserRepo();
  await rawPut({
    id: "meh",
    country: "usa",
    followers: [],
  });
  await expect(() => repo.get({ id: "meh" })).rejects.toMatchInlineSnapshot(
    `[single-table-OutputValidationError: Invalid data for User is stored in the database]`
  );

  // define migrate function
  repo.args.migrate = (rawObject: any) => {
    const next: InferObjectType<typeof repo> = { ...rawObject };
    if (!rawObject.city) {
      next.city = rawObject.id + "-city";
    }
    if (!rawObject.state) {
      next.state = rawObject.id + "-state";
    }
    return repo.put(next);
  };
  const spy = jest.spyOn(repo.args, "migrate");

  await expect(repo.get({ id: "meh" }, { fieldsToProject: ["id"] })).resolves
    .toMatchInlineSnapshot(`
Object {
  "id": "meh",
}
`);
  expect(spy).toHaveBeenCalledTimes(0);

  await expect(repo.get({ id: "meh" }, { fieldsToProject: ["id", "city"] }))
    .resolves.toMatchInlineSnapshot(`
Object {
  "city": "meh-city",
  "id": "meh",
}
`);
  expect(spy).toHaveBeenCalledTimes(1);

  await expect(repo.get({ id: "meh" }, { fieldsToProject: ["id", "city"] }))
    .resolves.toMatchInlineSnapshot(`
Object {
  "city": "meh-city",
  "id": "meh",
}
`);
  expect(spy).toHaveBeenCalledTimes(1);

  await expect(repo.get({ id: "meh" })).resolves.toMatchInlineSnapshot(`
Object {
  "city": "meh-city",
  "country": "usa",
  "followers": Array [],
  "id": "meh",
  "state": "meh-state",
}
`);
  expect(spy).toHaveBeenCalledTimes(1);
});
