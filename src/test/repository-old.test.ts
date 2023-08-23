import { Repository } from "../repository";
import sinon from "sinon";
import { z } from "zod";
import { getDocumentClient } from "./utils/getDocumentClient";

function getRepoAndStub() {
  const stub = sinon.stub(getDocumentClient());
  const repo = new Repository({
    tableName: "meow",
    typeName: "User",
    schema: z.object({
      id: z.string(),
      followers: z.array(z.string()).default([]),
      country: z.string(),
      city: z.string(),
      state: z.string(),
    }),
    primaryIndex: {
      tag: "primary",
      pk: "yay",
      sk: "meow",
      fields: ["id"],
    },
    documentClient: stub as any,
  });

  return { repo, stub };
}

describe("Repository", () => {
  let { repo, stub } = getRepoAndStub();

  beforeEach(() => {
    const args = getRepoAndStub();
    repo = args.repo;
    stub = args.stub;
  });

  test("merge should call document client with correct params", () => {
    stub.send.returns(Promise.resolve({}) as any);
    repo.mutate({
      id: "meow",
      city: "jimmy",
      state: "hendricks",
    });

    expect(stub.send.called).toBe(true);
    expect(stub.send.getCall(0)?.args[0].input).toMatchInlineSnapshot(`
Object {
  "ConditionExpression": "attribute_exists(yay) AND attribute_exists(meow)",
  "ExpressionAttributeNames": Object {
    "#attr0": "id",
    "#attr1": "city",
    "#attr2": "state",
  },
  "ExpressionAttributeValues": Object {
    ":value0": "meow",
    ":value1": "jimmy",
    ":value2": "hendricks",
  },
  "Key": Object {
    "meow": "User",
    "yay": "User#meow",
  },
  "ReturnValues": "ALL_NEW",
  "TableName": "meow",
  "UpdateExpression": "set #attr0 = :value0, #attr1 = :value1, #attr2 = :value2",
}
`);
  });

  test("parse works", () => {
    expect(() =>
      repo.mapper.parse(
        {
          id: "yay",
        },
        "input"
      )
    ).toThrowErrorMatchingInlineSnapshot(`"Unable to parse User input"`);

    expect(
      repo.mapper.parse({
        id: "yay",
        followers: ["123"],
        country: "usa",
        city: "richland",
        state: "wa",
      })
    ).toEqual({
      id: "yay",
      followers: ["123"],
      country: "usa",
      city: "richland",
      state: "wa",
    });

    expect(
      repo.mapper.parse({
        id: "yay",
        country: "usa",
        city: "richland",
        state: "wa",
      })
    ).toEqual({
      id: "yay",
      followers: [],
      country: "usa",
      city: "richland",
      state: "wa",
    });
  });

  test("partial parse works", () => {
    expect(
      repo.mapper.partialParse({
        id: "yay",
        randomField: "baaaaa",
      })
    ).toEqual({
      id: "yay",
    });
  });
});
