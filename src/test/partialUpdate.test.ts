import { Repository } from "..";
import { z } from "zod";
import { tableConfig } from "./utils/tableConfig";
import { getDocumentClient } from "./utils/getDocumentClient";
import { GetCommand } from "@aws-sdk/lib-dynamodb";

describe("repo.merge", () => {
  const ddb = getDocumentClient();
  const repo = new Repository({
    schema: z.object({
      id: z.string(),
      name: z.string(),
      birthDate: z.string(),
      country: z.string(),
    }),
    tableName: tableConfig.tableName,
    typeName: "User",
    primaryIndex: {
      ...tableConfig.primaryIndex,
      fields: ["id"],
    },
    secondaryIndexes: {
      "country,name": {
        fields: ["country", "name"],
        ...tableConfig.secondaryIndexes[1],
      },
      "birthDate,name": {
        fields: ["birthDate", "name"],
        ...tableConfig.secondaryIndexes[2],
      },
    },
    documentClient: ddb,
  });

  function getRaw(key: any) {
    return ddb
      .send(
        new GetCommand({
          TableName: tableConfig.tableName,
          Key: key,
        })
      )
      .then((thing) => {
        return thing.Item;
      });
  }

  test("objectToPutIfNotExists should work", async () => {
    const obj = await repo.mutate(
      {
        id: "yay",
        name: "george",
      },
      {
        objectToPutIfNotExists: {
          id: "yay",
          name: "fred",
          birthDate: "1990",
          country: "usa",
        },
      }
    );

    expect(obj).toMatchObject({
      birthDate: "1990",
      country: "usa",
      id: "yay",
      name: "fred",
    });

    expect(await getRaw(repo.getKey({ id: "yay" }))).toMatchObject({
      birthDate: "1990",
      country: "usa",
      id: "yay",
      name: "fred",
      pk0: "User#yay",
      pk2: "User#usa",
      pk3: "User#1990",
      sk0: "User",
      sk2: "User#fred",
      sk3: "User#fred",
    });
  });

  test("should not insert when object doesnt exist", async () => {
    const obj = await repo.mutate({
      id: "yay",
      name: "george",
    });

    expect(obj).toBe(null);

    expect(await getRaw(repo.getKey({ id: "yay" }))).toBe(undefined);
  });

  test("should update keys if possible", async () => {
    const obj0 = await repo.put({
      id: "yay",
      birthDate: "1990",
      country: "usa",
      name: "jim",
    });

    const initialObject = {
      birthDate: "1990",
      country: "usa",
      id: "yay",
      name: "jim",
      pk0: "User#yay",
      pk2: "User#usa",
      pk3: "User#1990",
      sk0: "User",
      sk2: "User#jim",
      sk3: "User#jim",
    };
    expect(await getRaw(repo.getKey({ id: "yay" }))).toMatchObject(
      initialObject
    );

    const obj1 = await repo.mutate({
      id: "yay",
      name: "george",
    });

    // should not update any indexes
    expect(obj1).toMatchObject({
      birthDate: "1990",
      country: "usa",
      id: "yay",
      name: "george",
    });

    expect(await getRaw(repo.getKey({ id: "yay" }))).toMatchObject({
      ...initialObject,
      name: "george",
    });

    // should update birthDate,name index
    const obj2 = await repo.mutate({
      id: "yay",
      name: "george",
      birthDate: "1990",
    });

    expect(obj2).toMatchObject({
      birthDate: "1990",
      country: "usa",
      id: "yay",
      name: "george",
    });

    expect(await getRaw(repo.getKey({ id: "yay" }))).toMatchObject({
      ...initialObject,
      name: "george",
      pk3: "User#1990",
      sk3: "User#george",
    });
  });
});
