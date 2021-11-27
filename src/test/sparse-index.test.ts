import { Mapper } from "../mapper";
import { tableConfig } from "./utils/table_config";
import { z } from "zod";

const schema = z.object({
  id: z.string(),
  state: z.string(),
  country: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  count: z.number().min(0),
  banned: z.string().optional(),
});

const mapper = new Mapper({
  typeName: "User",
  tableName: "Yeehaw",
  schema,
  primaryIndex: {
    ...tableConfig.primaryIndex,
    tag: "countryByStateByCreatedAt",
    fields: ["country", "state", "createdAt"],
  },
  secondaryIndexes: {
    stateByCountryByYeehaw: {
      ...tableConfig.secondaryIndexes[0],
      fields: ["state", "country", "count"],
      stringifyField: {
        count: () => "yeehaw",
      },
    },
    stateCreatedAt: {
      ...tableConfig.secondaryIndexes[1],
      shouldWriteIndex: (src) => src.state === "UT",
      fields: ["state", "createdAt", "count"],
      stringifyField: {
        count: () => "yeehaw",
      },
    },
    byBannedById: {
      ...tableConfig.secondaryIndexes[2],
      onlyWriteWhenAllFieldsPresent: true,
      fields: ["banned", "id"],
    },
    // countryByUpdatedAt: {
    // ...tableConfig.secondaryIndexes[3],
    // indexName: 'countryByUpdatedAt',
    // tag: 'meowowow',
    // partitionKey: 'state',
    // sortKey: 'country',
    // }
  },
});

test("should decorate all fields", () => {
  expect(
    mapper.decorateWithKeys({
      id: "yay",
      count: 23,
      banned: "yes",
      country: "usa",
      state: "UT",
      createdAt: "today",
      updatedAt: "tomorrow",
    })
  ).toMatchInlineSnapshot(`
    Object {
      "banned": "yes",
      "count": 23,
      "country": "usa",
      "createdAt": "today",
      "id": "yay",
      "pk1": "User#UT",
      "pk2": "User#UT",
      "pk3": "User#yes",
      "sk1": "User#usa#yeehaw",
      "sk2": "User#today#yeehaw",
      "sk3": "User#yay",
      "state": "UT",
      "updatedAt": "tomorrow",
    }
  `);
});

test("should decorate all fields except pk3,sk3", () => {
  expect(
    mapper.decorateWithKeys({
      id: "yay",
      count: 23,
      country: "usa",
      state: "UT",
      createdAt: "today",
      updatedAt: "tomorrow",
    })
  ).toMatchInlineSnapshot(`
    Object {
      "count": 23,
      "country": "usa",
      "createdAt": "today",
      "id": "yay",
      "pk1": "User#UT",
      "pk2": "User#UT",
      "sk1": "User#usa#yeehaw",
      "sk2": "User#today#yeehaw",
      "state": "UT",
      "updatedAt": "tomorrow",
    }
  `);
});

test("should decorate all fields except pk2, sk2 ", () => {
  expect(
    mapper.decorateWithKeys({
      id: "yay",
      count: 23,
      country: "usa",
      state: "WA",
      createdAt: "today",
      updatedAt: "tomorrow",
      banned: "yes",
    })
  ).toMatchInlineSnapshot(`
    Object {
      "banned": "yes",
      "count": 23,
      "country": "usa",
      "createdAt": "today",
      "id": "yay",
      "pk1": "User#WA",
      "pk3": "User#yes",
      "sk1": "User#usa#yeehaw",
      "sk3": "User#yay",
      "state": "WA",
      "updatedAt": "tomorrow",
    }
  `);
});
