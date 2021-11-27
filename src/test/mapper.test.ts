import { Mapper } from "../mapper";
import { z } from "zod";

const mapper = new Mapper({
  schema: z.object({
    state: z.string(),
    country: z.string(),
    createdAt: z.string(),
    id: z.string(),
    updatedAt: z.string(),
    count: z.number(),
  }),
  tableName: "yay",
  typeName: "User",
  primaryIndex: {
    pk: "pk1",
    sk: "sk1",
    fields: ["country", "state", "createdAt"],
  },
  secondaryIndexes: {
    no: {
      fields: ["state", "country", "createdAt"],
      indexName: "index1",
      pk: "pk2",
      sk: "sk2",
      stringifyField: {
        createdAt: () => "yeehaw",
      },
    },
  },
});

test("should format object for dynamodb properly", () => {
  expect(
    mapper.decorateWithKeys({
      updatedAt: "today",
      createdAt: "yesterday",
      country: "USA",
      id: "1234",
      state: "WA",
      count: 25,
    })
  ).toEqual({
    updatedAt: "today",
    createdAt: "yesterday",
    country: "USA",
    id: "1234",
    state: "WA",
    count: 25,

    pk1: "User#USA",
    pk2: "User#WA",
    sk1: "User#WA#yesterday",
    sk2: "User#USA#yeehaw",
  });

  expect(
    mapper.decorateWithKeys({
      updatedAt: "today",
      createdAt: "tomorrow",
      country: "USA",
      id: "1235",
      state: "UT",
      count: 33,
    })
  ).toEqual({
    updatedAt: "today",
    createdAt: "tomorrow",
    country: "USA",
    id: "1235",
    state: "UT",
    count: 33,

    pk1: "User#USA",
    sk1: "User#UT#tomorrow",

    pk2: "User#UT",
    sk2: "User#USA#yeehaw",
  });
});

test("should format partial index properly", () => {
  expect(
    mapper.getIndexKey(
      { country: "USA", state: "UT" },
      mapper.args.primaryIndex,
      { partial: true }
    )
  ).toEqual({
    pk1: "User#USA",
    sk1: "User#UT",
  });

  expect(
    mapper.getIndexKey({ country: "USA" }, mapper.args.primaryIndex, {
      partial: true,
    })
  ).toEqual({
    pk1: "User#USA",
    sk1: "User",
  });
});

test("should throw when no partition key is provided", () => {
  expect(() =>
    mapper.getIndexKey({} as any, mapper.args.primaryIndex, { partial: true })
  ).toThrow();
});
