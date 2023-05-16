import { Repository } from "../repository";
import { getDocumentClient } from "./utils/getDocumentClient";
import { tableConfig } from "./utils/tableConfig";
import { z } from "zod";
import { createDataLoader as _createLoader } from "../data-loader";
import { DataLoader } from "../mapper";

describe("DataLoader", () => {
  const createDataLoader = (client = getDocumentClient()) =>
    _createLoader(client);

  const createRepo = (loader?: DataLoader, docClient = getDocumentClient()) => {
    return new Repository({
      typeName: "Note",

      tableName: tableConfig.tableName,

      schema: z.object({
        id: z.string(),
        text: z.string().default("This is a note"),
        createdAt: z.string().default(() => new Date().toISOString()),
        owner: z.string(),
      }),

      primaryIndex: {
        fields: ["id"],
        ...tableConfig.primaryIndex,
      },

      secondaryIndexes: {
        owner: {
          fields: ["owner", "createdAt"],
          ...tableConfig.secondaryIndexes[0],
        },
      },

      dataLoader: loader,
      documentClient: docClient,
    });
  };

  test("put should be cached", async () => {
    const docClient = getDocumentClient();
    const loader = createDataLoader(docClient);
    const repo = createRepo(loader);
    const getSpy = jest.spyOn(docClient, "batchGet");

    await repo.put({
      text: "hello",
      id: "123",
      owner: "me",
      createdAt: "today",
    });

    await expect(repo.get({ id: "123" })).resolves.toMatchInlineSnapshot(`
Object {
  "createdAt": "today",
  "id": "123",
  "owner": "me",
  "text": "hello",
}
`);
    await repo.get({ id: "123" });
    await repo.get({ id: "123" });
    expect(getSpy).toBeCalledTimes(0);
  });

  test("should get when nothitng is cached", async () => {
    const docClient = getDocumentClient();
    const loader = createDataLoader(docClient);
    const repo = createRepo(loader);
    const spy = jest.spyOn(docClient, "batchGet");

    await expect(repo.get({ id: "123" })).resolves.toBe(null);
    expect(spy).toBeCalledTimes(1);
    await expect(repo.get({ id: "123" })).resolves.toBe(null);
    expect(spy).toBeCalledTimes(1);
  });

  test("batch put should be cached", async () => {
    const docClient = getDocumentClient();
    const loader = createDataLoader(docClient);
    const repo = createRepo(loader);
    const getSpy = jest.spyOn(docClient, "batchGet");

    await expect(
      repo.putMany([
        {
          id: "123",
          text: "hello",
          owner: "me",
          createdAt: "today",
        },
      ])
    ).resolves.toMatchInlineSnapshot(`
Array [
  Object {
    "createdAt": "today",
    "id": "123",
    "owner": "me",
    "text": "hello",
  },
]
`);

    await expect(repo.get({ id: "123" })).resolves.toMatchInlineSnapshot(`
Object {
  "createdAt": "today",
  "id": "123",
  "owner": "me",
  "text": "hello",
}
`);
    await repo.get({ id: "123" });
    await repo.get({ id: "123" });
    expect(getSpy).toBeCalledTimes(0);
  });

  test("merge should be cached", async () => {
    const docClient = getDocumentClient();
    const loader = createDataLoader(docClient);
    const repo = createRepo(loader);
    const getSpy = jest.spyOn(docClient, "batchGet");

    // put item with it getting cached in a dataloader
    await repo.put({
      text: "hello",
      id: "123",
      owner: "me",
      createdAt: "today",
    });

    await expect(repo.merge({ id: "123", text: "hello world" })).resolves
      .toMatchInlineSnapshot(`
Object {
  "createdAt": "today",
  "id": "123",
  "owner": "me",
  "text": "hello world",
}
`);

    await expect(repo.get({ id: "123" })).resolves.toMatchInlineSnapshot(`
Object {
  "createdAt": "today",
  "id": "123",
  "owner": "me",
  "text": "hello world",
}
`);

    await repo.get({ id: "123" });
    await repo.get({ id: "123" });
    expect(getSpy).toBeCalledTimes(0);
  });

  test("invoking put should cache items", async () => {
    const docClient = getDocumentClient();
    const loader = createDataLoader(docClient);
    const repo = createRepo(loader);
    const getSpy = jest.spyOn(docClient, "batchGet");

    await repo.put({
      text: "hello",
      id: "123",
      owner: "me",
      createdAt: "today",
    });

    expect(getSpy).toBeCalledTimes(0);

    expect(
      await repo.get({
        id: "123",
      })
    ).toMatchInlineSnapshot(`
Object {
  "createdAt": "today",
  "id": "123",
  "owner": "me",
  "text": "hello",
}
`);
    await repo.get({ id: "123" });
    await repo.get({ id: "123" });
    await repo.get({ id: "123" });
    expect(getSpy).toBeCalledTimes(0);
  });

  test("query should cache items", async () => {
    const docClient = getDocumentClient();
    const loader = createDataLoader(docClient);
    const repo = createRepo(loader);
    const getSpy = jest.spyOn(docClient, "batchGet");
    const noCacheRepo = createRepo();

    await noCacheRepo.put({
      text: "hello",
      createdAt: "today",
      id: "123",
      owner: "dwight",
    });

    await expect(repo.query("owner").where({ owner: "dwight" }).exec()).resolves.
toMatchInlineSnapshot(`
Object {
  "Count": 1,
  "Items": Array [
    Object {
      "createdAt": "today",
      "id": "123",
      "owner": "dwight",
      "text": "hello",
    },
  ],
  "ScannedCount": 1,
  "encodeCursor": [Function],
  "lastCursor": "eyJwazAiOiJOb3RlIzEyMyIsInNrMCI6Ik5vdGUiLCJwazEiOiJOb3RlI2R3aWdodCIsInNrMSI6Ik5vdGUjdG9kYXkifQ==",
}
`);

    await expect(repo.get({ id: "123" })).resolves.toMatchInlineSnapshot(`
Object {
  "createdAt": "today",
  "id": "123",
  "owner": "dwight",
  "text": "hello",
}
`);

    expect(getSpy).toBeCalledTimes(0);
    await repo.get({ id: "123" });
    await repo.get({ id: "123" });
    await repo.get({ id: "123" });
    expect(getSpy).toBeCalledTimes(0);
  });

  test("putExpression should cache items", async () => {
    const docClient = getDocumentClient();
    const loader = createDataLoader(docClient);
    const repo = createRepo(loader);
    const getSpy = jest.spyOn(docClient, "batchGet");

    await expect(
      repo.putExpression({
        text: "hello",
        id: "123",
        owner: "me",
        createdAt: "today",
      })
    ).resolves.toMatchInlineSnapshot(`
Object {
  "createdAt": "today",
  "id": "123",
  "owner": "me",
  "text": "hello",
}
`);

    await expect(repo.get({ id: "123" })).resolves.toMatchInlineSnapshot(`
Object {
  "createdAt": "today",
  "id": "123",
  "owner": "me",
  "text": "hello",
}
`);

    await repo.get({ id: "123" });
    await repo.get({ id: "123" });
    expect(getSpy).toBeCalledTimes(0);
  });

  test("delete should clear cache", async () => {
    const docClient = getDocumentClient();
    const loader = createDataLoader(docClient);
    const repo = createRepo(loader);
    const getSpy = jest.spyOn(docClient, "batchGet");

    await expect(
      repo.put({
        text: "hello",
        id: "123",
        owner: "me",
        createdAt: "today",
      })
    ).resolves.toMatchObject({ id: "123" });

    await expect(repo.get({ id: "123" })).resolves.toMatchObject({ id: "123" });
    await expect(getSpy).toBeCalledTimes(0);
    await expect(repo.delete({ id: "123" })).resolves.toBe(true);
    await expect(repo.get({ id: "123" })).resolves.toBe(null);
    await expect(getSpy).toBeCalledTimes(0);
  });

  test("deleteMany should be cached", async () => {
    const docClient = getDocumentClient();
    const loader = createDataLoader(docClient);
    const repo = createRepo(loader);
    const getSpy = jest.spyOn(docClient, "batchGet");

    await expect(
      repo.put({
        text: "hello",
        id: "123",
        owner: "me",
        createdAt: "today",
      })
    ).resolves.toMatchObject({ id: "123" });

    await expect(repo.get({ id: "123" })).resolves.toMatchObject({ id: "123" });
    await expect(getSpy).toBeCalledTimes(0);
    await expect(repo.deleteMany([{ id: "123" }])).resolves.toEqual([true]);
    await expect(repo.get({ id: "123" })).resolves.toBe(null);
    await expect(getSpy).toBeCalledTimes(0);
  });

  test("multiple repos can share loader", async () => {
    const docClient = getDocumentClient();
    const loader = createDataLoader(docClient);
    const repo1 = createRepo(loader);
    const repo2 = createRepo(loader);
    const repo3 = createRepo(undefined, docClient);
    const getSpy = jest.spyOn(docClient, "get");
    const batchGet = jest.spyOn(docClient, "batchGet");

    await expect(
      repo1.put({
        text: "hello",
        id: "123",
        owner: "me",
        createdAt: "today",
      })
    ).resolves.toMatchObject({ id: "123" });

    await expect(repo2.get({ id: "123" })).resolves.toMatchObject({
      id: "123",
    });
    await expect(repo1.get({ id: "123" })).resolves.toMatchObject({
      id: "123",
    });
    await expect(repo3.get({ id: "123" })).resolves.toMatchObject({
      id: "123",
    });
    await expect(batchGet).toBeCalledTimes(0);
    expect(getSpy).toBeCalledTimes(1);
  });

  test("should cache when no item exists", async () => {
    const docClient = getDocumentClient();
    const loader = createDataLoader(docClient);
    const repo = createRepo(loader);
    const batchGet = jest.spyOn(docClient, "batchGet");

    await expect(repo.get({ id: "123" })).resolves.toBe(null);
    await expect(repo.get({ id: "123" })).resolves.toBe(null);
    await expect(repo.get({ id: "123" })).resolves.toBe(null);
    expect(batchGet).toBeCalledTimes(1);
  });

  test("force fetch should work", async () => {
    const docClient = getDocumentClient();
    const loader = createDataLoader(docClient);
    const repo = createRepo(loader);
    const batchGet = jest.spyOn(docClient, "batchGet");
    // item is cached after put
    await expect(repo.put({ id: "123", owner: "me" })).resolves.toMatchObject({
      id: "123",
    });
    await expect(repo.get({ id: "123" })).resolves.toMatchObject({ id: "123" });
    expect(batchGet).toBeCalledTimes(0);

    // force fetch should work
    await expect(
      repo.get({ id: "123" }, { forceFetch: true })
    ).resolves.toMatchObject({ id: "123" });
    expect(batchGet).toBeCalledTimes(1);

    // item is cached after force fetch
    await expect(repo.get({ id: "123" })).resolves.toMatchObject({ id: "123" });
    await expect(repo.get({ id: "123" })).resolves.toMatchObject({ id: "123" });
    expect(batchGet).toBeCalledTimes(1);
  });
});
