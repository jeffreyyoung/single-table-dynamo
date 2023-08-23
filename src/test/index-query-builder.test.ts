import { IndexQueryBuilder } from "../index-query-builder";
import { IndexBase, Mapper } from "../mapper";
import { z } from "zod";
import { range } from "./utils/tableConfig";
import { getNoteRepo } from "./utils/getNoteRepo";

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

test("filter expression should work", async () => {
  const notes = getNoteRepo();
  await notes.putMany(
    range(10).map((age) => ({
      id: "id" + age,
      name: "note" + age,
      owner: "jeff",
      tag: "food",
      ageInYears: age,
      body: "yay",
    }))
  );

  expect(
    await notes
      .query("tag,owner,name")
      .where({ tag: "food" })
      .filter("ageInYears", ">", 3)
      .limit(5)
      .exec()
      .then((r) => {
        r.$metadata.requestId = "yay";
        return r;
      })
  ).toMatchInlineSnapshot(`
Object {
  "$metadata": Object {
    "attempts": 1,
    "cfId": undefined,
    "extendedRequestId": undefined,
    "httpStatusCode": 200,
    "requestId": "yay",
    "totalRetryDelay": 0,
  },
  "Count": 1,
  "Items": Array [
    Object {
      "ageInYears": 4,
      "body": "yay",
      "id": "id4",
      "name": "note4",
      "owner": "jeff",
      "tag": "food",
    },
  ],
  "LastEvaluatedKey": Object {
    "pk0": "Note#id4",
    "pk2": "Note#food",
    "sk0": "Note",
    "sk2": "Note#jeff#note4",
  },
  "ScannedCount": 5,
  "encodeCursor": [Function],
  "hasNextPage": true,
  "lastCursor": "eyJwazAiOiJOb3RlI2lkNCIsInNrMCI6Ik5vdGUiLCJwazIiOiJOb3RlI2Zvb2QiLCJzazIiOiJOb3RlI2plZmYjbm90ZTQifQ==",
}
`);
});

test("last cursor should work with filter expression", async () => {
  const notes = getNoteRepo();
  await notes.putMany([
    {
      id: "id1",
      name: "note1",
      owner: "jeff",
      tag: "food",
      ageInYears: 1,
      body: "yay",
    },
    {
      id: "id2",
      name: "note2",
      owner: "jeff",
      tag: "food",
      ageInYears: 4,
      body: "yay",
    },
  ]);
  const res = await notes
    .query("tag,owner,name")
    .where({ tag: "food" })
    .filter("ageInYears", ">", 3)
    .limit(1)
    .exec()
    .then((r) => {
      r.$metadata.requestId = "yay";
      return r;
    });
  expect(res).toMatchInlineSnapshot(`
Object {
  "$metadata": Object {
    "attempts": 1,
    "cfId": undefined,
    "extendedRequestId": undefined,
    "httpStatusCode": 200,
    "requestId": "yay",
    "totalRetryDelay": 0,
  },
  "Count": 0,
  "Items": Array [],
  "LastEvaluatedKey": Object {
    "pk0": "Note#id1",
    "pk2": "Note#food",
    "sk0": "Note",
    "sk2": "Note#jeff#note1",
  },
  "ScannedCount": 1,
  "encodeCursor": [Function],
  "hasNextPage": true,
  "lastCursor": "eyJwazAiOiJOb3RlI2lkMSIsInNrMCI6Ik5vdGUiLCJwazIiOiJOb3RlI2Zvb2QiLCJzazIiOiJOb3RlI2plZmYjbm90ZTEifQ==",
}
`);
});
