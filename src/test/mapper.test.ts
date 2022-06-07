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
    mapper.getIndexKeys({
      updatedAt: "today",
      createdAt: "yesterday",
      country: "USA",
      id: "1234",
      state: "WA",
      count: 25,
    })
  ).toEqual({
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
mapper.getIndexKey(({} as any), mapper.args.primaryIndex, { partial: true })).
toThrowErrorMatchingInlineSnapshot(`"To query index (pk1, sk1), field: country is required, recieved {}"`);
});

test("mapper.updateWithSomeFields should work", () => {
  const mapper = new Mapper({
    schema: z.object({
      id: z.string(),
      name: z.string(),
      birthDate: z.string(),
      country: z.string(),
    }),
    tableName: "yay",
    typeName: "User",
    primaryIndex: {
      pk: "pk0",
      sk: "sk0",
      fields: ["id"],
    },
    secondaryIndexes: {
      "country,name": {
        fields: ["country", "name"],
        indexName: "index1",
        pk: "pk1",
        sk: "sk1",
      },
      "birthDate,name": {
        fields: ["birthDate", "name"],
        indexName: "index2",
        pk: "pk2",
        sk: "sk2",
      },
    },
  });

  expect(
    mapper.partialDecorateWithKeys({ birthDate: "1990-01-01", name: "Phil" })
  ).toMatchObject({
    birthDate: "1990-01-01",
    name: "Phil",
    pk2: "User#1990-01-01",
    sk2: "User#Phil",
  });

  expect(
    mapper.partialDecorateWithKeys({ country: "USA", name: "Phil" })
  ).toMatchObject({
    country: "USA",
    name: "Phil",
    pk1: "User#USA",
    sk1: "User#Phil",
  });

  expect(() =>
mapper.decorateWithKeys(({
  id: "1",
  country: "usa" } as
any))).
toThrowErrorMatchingInlineSnapshot(`"To query index (pk1, sk1), field: name is required, recieved {\\"id\\":\\"1\\",\\"country\\":\\"usa\\"}"`);

  const fullObject = {
    birthDate: "1990",
    country: "usa",
    id: "1",
    name: "sally",
    pk0: "User#1",
    pk1: "User#usa",
    pk2: "User#1990",
    sk0: "User",
    sk1: "User#sally",
    sk2: "User#sally",
  };

  expect(
    mapper.decorateWithKeys({
      id: "1",
      birthDate: "1990",
      country: "usa",
      name: "sally",
    })
  ).toMatchObject(fullObject);

  expect(
    mapper.partialDecorateWithKeys({
      id: "1",
      birthDate: "1990",
      country: "usa",
      name: "sally",
    })
  ).toMatchObject(fullObject);
});
