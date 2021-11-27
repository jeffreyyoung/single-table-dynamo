import { Repository } from "../repository";
import sinon from "sinon";
import Sinon from "sinon";
import { DocumentClient } from "aws-sdk/clients/dynamodb";
import { z } from "zod";
import { expectTypeOf } from "expect-type";

function getRepoAndStub() {
  const stub = sinon.stub(new DocumentClient());
  const repo = new Repository(
    {
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
    },
    stub
  );

  return { repo, stub };
}

describe("Repository", () => {
  let { repo, stub } = getRepoAndStub();
  beforeEach(() => {
    let args = getRepoAndStub();
    repo = args.repo;
    stub = args.stub;
  });

  test("updateUnsafe should call document client with correct params", () => {
    stub.update.returns({ promise: () => ({}) } as any);
    repo.updateUnsafe(
      { id: "meow" },
      {
        city: "jimmy",
        state: "hendricks",
      }
    );

    expect(stub.update.called).toBe(true);
    expect(stub.update.getCall(0)?.args).toMatchInlineSnapshot(`
      Array [
        Object {
          "ConditionExpression": "attribute_exists(#attr2) and attribute_exists(#attr3)",
          "ExpressionAttributeNames": Object {
            "#attr0": "city",
            "#attr1": "state",
            "#attr2": "yay",
            "#attr3": "meow",
          },
          "ExpressionAttributeValues": Object {
            ":value0": "jimmy",
            ":value1": "hendricks",
          },
          "Key": Object {
            "meow": "User",
            "yay": "User#meow",
          },
          "ReturnValues": "ALL_NEW",
          "TableName": "meow",
          "UpdateExpression": "set #attr0 = :value0, #attr1 = :value1",
        },
      ]
    `);
  });

  test("parse works", () => {
    expect(() =>
      repo.mapper.parse({
        id: "yay",
      })
    ).toThrowError();

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
      })
    ).toEqual({
      id: "yay",
    });
  });
});
