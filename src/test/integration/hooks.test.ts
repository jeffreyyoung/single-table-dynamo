import { Repository } from "../../repository";
import { DocumentClient } from "aws-sdk/clients/dynamodb";
import { z } from "zod";
import { tableConfig } from "../utils/tableConfig";
import { getDocumentClient } from "../utils/getDocumentClient";

const ddb = new DocumentClient({
  ...(process.env.MOCK_DYNAMODB_ENDPOINT && {
    endpoint: process.env.MOCK_DYNAMODB_ENDPOINT,
    sslEnabled: false,
    region: "local",
  }),
});

test("hooks should get called", async () => {
  const spies = {
    get: jest.fn(),
    delete: jest.fn(),
    put: jest.fn(),
    query: jest.fn(),
    mutate: jest.fn(),
  };
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
    on: spies,
    documentClient: ddb,
  });

  await thingRepo.put({ id: "1", name: "meow" });
  await thingRepo.get({ id: "1" });
  await thingRepo.mutate({ id: "1", name: "yeehaw" });
  await thingRepo.get({ id: "1" });
  await thingRepo.delete({ id: "1" });
  await thingRepo.get({ id: "1" });

  expect(spies.put.mock.calls).toMatchInlineSnapshot(`
Array [
  Array [
    Array [
      Object {
        "id": "1",
        "name": "meow",
      },
      Object {
        "mode": "upsert",
      },
    ],
    Object {
      "id": "1",
      "name": "meow",
    },
    Object {
      "Item": Object {
        "id": "1",
        "name": "meow",
        "pk1": "Thing#1",
        "sk1": "Thing",
      },
      "Key": Object {
        "pk1": "Thing#1",
        "sk1": "Thing",
      },
      "TableName": "table1",
    },
  ],
]
`);
  expect(spies.get.mock.calls).toMatchInlineSnapshot(`
Array [
  Array [
    Array [
      Object {
        "id": "1",
      },
    ],
    Object {
      "id": "1",
      "name": "meow",
    },
    Object {
      "Item": Object {
        "id": "1",
        "name": "meow",
        "pk1": "Thing#1",
        "sk1": "Thing",
      },
      "Key": Object {
        "pk1": "Thing#1",
        "sk1": "Thing",
      },
      "TableName": "table1",
    },
  ],
  Array [
    Array [
      Object {
        "id": "1",
      },
    ],
    Object {
      "id": "1",
      "name": "yeehaw",
    },
    Object {
      "Item": Object {
        "id": "1",
        "name": "yeehaw",
        "pk1": "Thing#1",
        "sk1": "Thing",
      },
      "Key": Object {
        "pk1": "Thing#1",
        "sk1": "Thing",
      },
      "TableName": "table1",
    },
  ],
  Array [
    Array [
      Object {
        "id": "1",
      },
    ],
    null,
    Object {
      "Item": null,
      "Key": Object {
        "pk1": "Thing#1",
        "sk1": "Thing",
      },
      "TableName": "table1",
    },
  ],
]
`);
  expect(spies.mutate.mock.calls).toMatchInlineSnapshot(`
Array [
  Array [
    Array [
      Object {
        "id": "1",
        "name": "yeehaw",
      },
      Object {},
    ],
    Object {
      "id": "1",
      "name": "yeehaw",
    },
    Object {
      "Item": Object {
        "id": "1",
        "name": "yeehaw",
      },
      "Key": Object {
        "pk1": "Thing#1",
        "sk1": "Thing",
      },
      "TableName": "table1",
    },
  ],
]
`);
  expect(spies.delete.mock.calls).toMatchInlineSnapshot(`
    Array [
      Array [
        Array [
          Object {
            "id": "1",
          },
        ],
        true,
        Object {
          "Key": Object {
            "pk1": "Thing#1",
            "sk1": "Thing",
          },
          "TableName": "table1",
        },
      ],
    ]
  `);
});

test("defaults on primary index works", async () => {
  const spies = {
    get: jest.fn(),
    delete: jest.fn(),
    put: jest.fn(),
    query: jest.fn(),
    mutate: jest.fn(),
  };
  const repo = new Repository({
    typeName: "thingy",
    schema: z.object({
      first: z.string().default(() => "henry"),
      last: z.string().default(() => "jacobs"),
      age: z.number(),
    }),
    primaryIndex: {
      fields: ["last", "first"],
      tag: "last,first",
      ...tableConfig.primaryIndex,
    },

    tableName: tableConfig.tableName,
    on: spies,

    documentClient: getDocumentClient(),
  });

  await expect(repo.put({ age: 5 })).resolves.toMatchInlineSnapshot(`
Object {
  "age": 5,
  "first": "henry",
  "last": "jacobs",
}
`);
});
