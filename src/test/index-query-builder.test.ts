import { IndexQueryBuilder } from "../index-query-builder";
import { IndexBase, Mapper } from "../mapper";
import { z } from "zod";

const mapper = new Mapper({
  typeName: "User",
  tableName: "table1",
  schema: z.object({
    state: z.string(),
    country: z.string(),
    createdAt: z.string(),
    id: z.string(),
    updatedAt: z.string(),
    count: z.number(),
  }),
  primaryIndex: {
    pk: "pk1",
    sk: "sk1",
    tag: "countryByStateByCreatedAt",
    fields: ["country", "state", "createdAt"],
  },
  secondaryIndexes: {
    stateByCountryByYeehaw: {
      indexName: "third",
      pk: "pk2",
      sk: "sk2",
      fields: ["state", "country", "count"],
    },

    // {
    //   indexName: 'countryByUpdatedAt',
    //   tag: 'meowowow',
    //   partitionKey: 'state',
    //   sortKey: 'country',
    // },
  },
  documentClient: {} as any,
});

const getBuilder = <T>(index: IndexBase<T>) =>
  new IndexQueryBuilder<any>({ tableName: "yeehaw", index, mapper } as any);

test("should build query with no sortkey", () => {
  expect(
    getBuilder(mapper.args.primaryIndex as any)
      .where({
        country: "USA",
      })
      .limit(25)
      .build()
  ).toEqual({
    ExpressionAttributeNames: {
      "#attr0": "pk1",
      "#attr1": "sk1",
    },
    ExpressionAttributeValues: {
      ":value0": "User#USA",
      ":value1": "User",
    },
    Limit: 25,
    KeyConditionExpression: "#attr0 = :value0 and begins_with(#attr1, :value1)",
    ScanIndexForward: true,
    TableName: "yeehaw",
  });

  expect(
    getBuilder(mapper.args.primaryIndex as any)
      .where({
        country: "USA",
      })
      .limit(25)
      .sort("asc")
      .build()
  ).toEqual({
    ExpressionAttributeNames: {
      "#attr0": "pk1",
      "#attr1": "sk1",
    },
    ExpressionAttributeValues: {
      ":value0": "User#USA",
      ":value1": "User",
    },
    Limit: 25,
    KeyConditionExpression: "#attr0 = :value0 and begins_with(#attr1, :value1)",
    ScanIndexForward: true,
    TableName: "yeehaw",
  });
});

test("should build query with extra fields", () => {
  expect(
    getBuilder(mapper.args.primaryIndex as any)
      .where({
        country: "USA",
        createdAt: "2010-10-21",
      })
      .limit(25)
      .build()
  ).toEqual({
    ExpressionAttributeNames: {
      "#attr0": "pk1",
      "#attr1": "sk1",
    },
    ExpressionAttributeValues: {
      ":value0": "User#USA",
      ":value1": "User",
    },
    Limit: 25,
    KeyConditionExpression: "#attr0 = :value0 and begins_with(#attr1, :value1)",
    ScanIndexForward: true,
    TableName: "yeehaw",
  });
});

test("should build query with sortkey", () => {
  expect(
    getBuilder(mapper.args.primaryIndex)
      .where({
        country: "USA",
        state: "UT",
      })
      .limit(25)
      .build()
  ).toEqual({
    ExpressionAttributeNames: {
      "#attr0": "pk1",
      "#attr1": "sk1",
    },
    ExpressionAttributeValues: {
      ":value0": "User#USA",
      ":value1": "User#UT",
    },
    KeyConditionExpression: "#attr0 = :value0 and begins_with(#attr1, :value1)",
    ScanIndexForward: true,
    Limit: 25,
    TableName: "yeehaw",
  });
});

test("should throw with no partition key", () => {
  expect(() =>
    getBuilder(mapper.args.primaryIndex)
      .where({
        state: "UT",
      })
      .limit(25)
      .build()
  ).toThrowErrorMatchingInlineSnapshot(
    `"To query index (pk1, sk1), field: country is required, recieved {\\"state\\":\\"UT\\"}"`
  );
});

test("should build non primary index", () => {
  expect(
    getBuilder(mapper.args.secondaryIndexes!["stateByCountryByYeehaw"])
      .where({
        state: "WA",
      })
      .build()
  ).toEqual({
    ExpressionAttributeNames: {
      "#attr0": "pk2",
      "#attr1": "sk2",
    },
    ExpressionAttributeValues: {
      ":value0": "User#WA",
      ":value1": "User",
    },
    KeyConditionExpression: "#attr0 = :value0 and begins_with(#attr1, :value1)",
    IndexName: "third",
    Limit: 25,
    ScanIndexForward: true,
    TableName: "yeehaw",
  });
});
