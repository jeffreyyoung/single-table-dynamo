import { QueryBuilder } from "../query-builder";
import { getStudentRepo } from "./utils/getStudentRepo";
import { getUserRepo } from "./utils/getUserRepo";

test("should format query request properly", () => {
  const builder = new QueryBuilder();

  expect(
    builder
      .table("MyTable")
      .index("MyIndex")
      .where("Country", "=", "USA")
      .where("Name", "BEGINS_WITH", "Jef")
      .limit(27)
      .cursor({ Country: "Belgium", Name: "Jim" })
      .build()
  ).toEqual({
    ExclusiveStartKey: {
      Country: "Belgium",
      Name: "Jim",
    },
    Limit: 27,
    ExpressionAttributeNames: {
      "#attr0": "Country",
      "#attr1": "Name",
    },
    ExpressionAttributeValues: {
      ":value0": "USA",
      ":value1": "Jef",
    },
    IndexName: "MyIndex",
    KeyConditionExpression: "#attr0 = :value0 and begins_with(#attr1, :value1)",
    ScanIndexForward: true,
    TableName: "MyTable",
  });
});

test("should format filter correctly", () => {
  const builder = new QueryBuilder();

  expect(
    builder
      .table("MyTable")
      .index("MyIndex")
      .where("Country", "=", "USA")
      .where("Name", "BEGINS_WITH", "Jef")
      .filter("Age", ">", 16)
      .filter("LastName", "BEGINS_WITH", "Y")
      .limit(27)
      .cursor({ Country: "Belgium", Name: "Jim" })
      .build()
  ).toMatchInlineSnapshot(`
Object {
  "ExclusiveStartKey": Object {
    "Country": "Belgium",
    "Name": "Jim",
  },
  "ExpressionAttributeNames": Object {
    "#attr0": "Country",
    "#attr1": "Name",
    "#attr2": "Age",
    "#attr3": "LastName",
  },
  "ExpressionAttributeValues": Object {
    ":value0": "USA",
    ":value1": "Jef",
    ":value2": 16,
    ":value3": "Y",
  },
  "FilterExpression": "#attr2 > :value2 and begins_with(#attr3, :value3)",
  "IndexName": "MyIndex",
  "KeyConditionExpression": "#attr0 = :value0 and begins_with(#attr1, :value1)",
  "Limit": 27,
  "ScanIndexForward": true,
  "TableName": "MyTable",
}
`);
});

test("last cursor should work", async () => {
  const students = getStudentRepo();

  await students.putMany([
    { id: "1", last: "y", first: "a" },
    { id: "2", last: "y", first: "b" },
    { id: "3", last: "y", first: "c" },
  ]);
  const query = students.query("last,first").where({ last: "y" }).limit(1);
  const result1 = await query.exec();
  // @ts-ignore
  delete result1.$metadata;
  expect(result1).toMatchInlineSnapshot(`
Object {
  "Count": 1,
  "Items": Array [
    Object {
      "first": "a",
      "grade": 0,
      "id": "1",
      "last": "y",
    },
  ],
  "LastEvaluatedKey": Object {
    "pk0": "Student#1",
    "pk1": "Student#y",
    "sk0": "Student",
    "sk1": "Student#a",
  },
  "ScannedCount": 1,
  "encodeCursor": [Function],
  "hasNextPage": true,
  "lastCursor": "eyJwazAiOiJTdHVkZW50IzEiLCJzazAiOiJTdHVkZW50IiwicGsxIjoiU3R1ZGVudCN5Iiwic2sxIjoiU3R1ZGVudCNhIn0=",
}
`);

  const result2 = await query.cursor(result1.lastCursor!).exec();
  // @ts-ignore
  delete result2.$metadata;
  expect(result2).toMatchInlineSnapshot(`
Object {
  "Count": 1,
  "Items": Array [
    Object {
      "first": "b",
      "grade": 0,
      "id": "2",
      "last": "y",
    },
  ],
  "LastEvaluatedKey": Object {
    "pk0": "Student#2",
    "pk1": "Student#y",
    "sk0": "Student",
    "sk1": "Student#b",
  },
  "ScannedCount": 1,
  "encodeCursor": [Function],
  "hasNextPage": true,
  "lastCursor": "eyJwazAiOiJTdHVkZW50IzIiLCJzazAiOiJTdHVkZW50IiwicGsxIjoiU3R1ZGVudCN5Iiwic2sxIjoiU3R1ZGVudCNiIn0=",
}
`);

  const result3 = await query.cursor(result2.lastCursor!).limit(2).exec();
  // @ts-ignore
  delete result3.$metadata;
  expect(result3).toMatchInlineSnapshot(`
Object {
  "Count": 1,
  "Items": Array [
    Object {
      "first": "c",
      "grade": 0,
      "id": "3",
      "last": "y",
    },
  ],
  "LastEvaluatedKey": undefined,
  "ScannedCount": 1,
  "encodeCursor": [Function],
  "hasNextPage": false,
  "lastCursor": undefined,
}
`);
});
