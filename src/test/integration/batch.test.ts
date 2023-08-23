import { Repository } from "../../repository";
import { batchPut, batchWrite } from "../../batch-write";
import { batchGet } from "../../batch-get";
import { z } from "zod";
import { getDocumentClient } from "../utils/getDocumentClient";

const ddb = getDocumentClient();
const personRepo = new Repository({
  schema: z.object({
    personId: z.string().default(() => Math.random() + ""),
    name: z.string().default("jimmy"),
  }),
  tableName: "table1",
  typeName: "Person",
  primaryIndex: {
    tag: "primary",
    pk: "pk1",
    sk: "sk1",
    fields: ["personId"],
  },
  documentClient: ddb,
});

const thingRepo = new Repository({
  schema: z.object({
    id: z.string(),
    name: z.string(),
  }),
  tableName: "table1",
  typeName: "Thing",
  primaryIndex: {
    tag: "primary",
    pk: "pk1",
    sk: "sk1",
    fields: ["id"],
  },
  documentClient: ddb,
});

test("should handle custom fieldsToProject <deprecated/>", async () => {
  await batchPut({
    ddb,
    requests: [
      thingRepo.batch.put({ id: "1", name: "yes" }),
      thingRepo.batch.put({ id: "2", name: "no" }),
      thingRepo.batch.put({ id: "3", name: "maybe" }),
      personRepo.batch.put({ personId: "hello?", name: "ok" }),
    ],
  });

  expect(
    await batchGet(ddb, [
      thingRepo.batch.get({ id: "1" }),
      thingRepo.batch.get({ id: "1" }),
      thingRepo.batch.get({ id: "1" }),
      personRepo.batch.get({ personId: "hello?" }),
    ])
  ).toMatchInlineSnapshot(`
Array [
  Object {
    "id": "1",
    "name": "yes",
    "pk1": "Thing#1",
    "sk1": "Thing",
  },
  Object {
    "id": "1",
    "name": "yes",
    "pk1": "Thing#1",
    "sk1": "Thing",
  },
  Object {
    "id": "1",
    "name": "yes",
    "pk1": "Thing#1",
    "sk1": "Thing",
  },
  Object {
    "name": "ok",
    "personId": "hello?",
    "pk1": "Person#hello?",
    "sk1": "Person",
  },
]
`);

  // should merge fields to project
  expect(
    await batchGet(ddb, [
      thingRepo.batch.get({ id: "1" }),
      thingRepo.batch.get({ id: "1" }),
      thingRepo.batch.get({ id: "1" }),
      personRepo.batch.get({ personId: "hello?" }),
    ])
  ).toMatchInlineSnapshot(`
    Array [
      Object {
        "id": "1",
        "name": "yes",
        "pk1": "Thing#1",
        "sk1": "Thing",
      },
      Object {
        "id": "1",
        "name": "yes",
        "pk1": "Thing#1",
        "sk1": "Thing",
      },
      Object {
        "id": "1",
        "name": "yes",
        "pk1": "Thing#1",
        "sk1": "Thing",
      },
      Object {
        "name": "ok",
        "personId": "hello?",
        "pk1": "Person#hello?",
        "sk1": "Person",
      },
    ]
  `);
});

test("batch get should handle duplicate keys for objects that do not exist", async () => {
  await expect(
    await batchGet(ddb, [
      { TableName: "THINGS_TABLE", Key: { pk0: "User#env2", sk0: "User" } },
      {
        TableName: "THINGS_TABLE",
        Key: { pk0: "Community#wyHwHdx83x8UZlutb2kr-", sk0: "Community" },
      },
      { TableName: "THINGS_TABLE", Key: { pk0: "User#env3", sk0: "User" } },
      {
        TableName: "THINGS_TABLE",
        Key: { pk0: "Community#wyHwHdx83x8UZlutb2kr-", sk0: "Community" },
      },
    ])
  ).toEqual([undefined, undefined, undefined, undefined]);
});

test("types should infer correctly", async () => {
  await expect(
    batchGet(ddb, [
      personRepo.batch.get({ personId: "meow" }),
      thingRepo.batch.get({ id: "nooo" }),
    ])
  ).resolves.toEqual([undefined, undefined]);
});

test("batch write should work with one table", async () => {
  const ids = [...Array(35).keys()].map((id) => String(id));

  await expect(
    batchWrite({
      ddb,
      requests: [
        ...ids.map((id) => thingRepo.batch.put({ id, name: "meow" })),
        ...ids.map((id) => personRepo.batch.put({ personId: id, name: "yo" })),
      ],
    })
  ).resolves.toHaveLength(70);

  await expect(
    batchGet(ddb, [
      ...ids.map((id) => thingRepo.batch.get({ id })),
      ...ids.map((id) => personRepo.batch.get({ personId: id })),
    ])
  ).resolves.toMatchObject([
    ...ids.map((id) => ({ id, name: "meow" })),
    ...ids.map((id) => ({ personId: id, name: "yo" })),
  ]);
});

test("should handle duplicates and maintain order", async () => {
  await expect(
    batchWrite({
      ddb,
      requests: [
        thingRepo.batch.put({ id: "1", name: "yay" }),
        thingRepo.batch.put({ id: "2", name: "yay" }),
      ],
    })
  ).resolves.toHaveLength(2);

  await expect(
    batchGet(ddb, [
      thingRepo.batch.get({ id: "1" }),
      thingRepo.batch.get({ id: "1" }),
      thingRepo.batch.get({ id: "1" }),
      thingRepo.batch.get({ id: "2" }),
      thingRepo.batch.get({ id: "1" }),
      thingRepo.batch.get({ id: "5" }),
      thingRepo.batch.get({ id: "2" }),
    ])
  ).resolves.toMatchObject([
    { id: "1" },
    { id: "1" },
    { id: "1" },
    { id: "2" },
    { id: "1" },
    undefined,
    { id: "2" },
  ]);
});
