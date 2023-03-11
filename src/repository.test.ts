import { Repository } from "./repository";
import { z } from "zod";
import { getDocumentClient } from "./test/utils/getDocumentClient";
import { tableConfig } from "./test/utils/tableConfig";
const ddb = getDocumentClient();

const getUserRepo = () =>
  new Repository(
    {
      tableName: "table1",
      typeName: "User",
      schema: z.object({
        id: z.string(),
        followers: z.array(z.string()),
        country: z.string(),
        city: z.string(),
        state: z.string(),
      }),
      primaryIndex: {
        tag: "primary",
        pk: "pk1",
        sk: "sk1",
        fields: ["id"],
      },
      secondaryIndexes: {
        byCountryByStateByCity: {
          pk: "pk2",
          sk: "sk2",
          fields: ["country", "state", "city"],
          indexName: "gsi1",
        },
      },
    },
    ddb
  );

test("projection expression should work", async () => {
  const repo = getUserRepo();

  await repo.put({
    city: "gump",
    state: "forest",
    country: "vietnam",
    followers: [],
    id: "5",
  });

  await expect(repo.get({ id: "5" })).resolves.toMatchInlineSnapshot(`
Object {
  "city": "gump",
  "country": "vietnam",
  "followers": Array [],
  "id": "5",
  "state": "forest",
}
`);
});

test("getDocument works as expected", async () => {
  const repo = new Repository(
    {
      ...getUserRepo().args,
      getDocument: (args) => ddb.get(args).promise(),
    },
    ddb
  );

  await repo.put({
    city: "gump",
    state: "forest",
    country: "vietnam",
    followers: [],
    id: "5",
  });

  await expect(repo.get({ id: "5" })).resolves.toMatchObject({
    city: "gump",
    state: "forest",
    country: "vietnam",
    followers: [],
    id: "5",
  });
});

test("get, put, delete, dangerouslyUpdate, and query should work", async () => {
  const repo = getUserRepo();
  await expect(repo.get({ id: "yay" })).resolves.toEqual(null);

  const obj = {
    id: "yay",
    city: "scranton",
    country: "CA",
    followers: [],
    state: "PA",
  };

  await expect(repo.put(obj)).resolves.toEqual(obj);

  await expect(repo.get({ id: "yay" })).resolves.toMatchInlineSnapshot(`
          Object {
            "city": "scranton",
            "country": "CA",
            "followers": Array [],
            "id": "yay",
            "state": "PA",
          }
        `);

  await expect(() =>
    repo.query("primary").where({ city: "scranton" }).exec()
  ).toThrowErrorMatchingInlineSnapshot(
    `"To query index (pk1, sk1), field: id is required, recieved {\\"city\\":\\"scranton\\"}"`
  );

  await expect(() =>
    repo.query("byCountryByStateByCity").where({ city: "scranton" }).exec()
  ).toThrowErrorMatchingInlineSnapshot(
    `"To query index (pk2, sk2), field: country is required, recieved {\\"city\\":\\"scranton\\"}"`
  );

  await expect(
    repo.query("byCountryByStateByCity").where({ country: "CA" }).exec()
  ).resolves.toMatchInlineSnapshot(`
Object {
  "Count": 1,
  "Items": Array [
    Object {
      "city": "scranton",
      "country": "CA",
      "followers": Array [],
      "id": "yay",
      "state": "PA",
    },
  ],
  "ScannedCount": 1,
  "encodeCursor": [Function],
  "lastCursor": "{\\"pk1\\":\\"User#yay\\",\\"sk1\\":\\"User\\",\\"pk2\\":\\"User#CA\\",\\"sk2\\":\\"User#PA#scranton\\"}",
}
`);

  await expect(repo.dangerouslyUpdate({ id: obj.id }, { followers: ["yay1"] }))
    .resolves.toMatchInlineSnapshot(`
          Object {
            "city": "scranton",
            "country": "CA",
            "followers": Array [
              "yay1",
            ],
            "id": "yay",
            "state": "PA",
          }
        `);

  await expect(() =>
    repo.dangerouslyUpdate({ id: "NON_EXISTANT_ID" }, { followers: ["YAY"] })
  ).rejects;

  await expect(
    repo.query("byCountryByStateByCity").where({ country: "CA" }).exec()
  ).resolves.toMatchInlineSnapshot(`
Object {
  "Count": 1,
  "Items": Array [
    Object {
      "city": "scranton",
      "country": "CA",
      "followers": Array [
        "yay1",
      ],
      "id": "yay",
      "state": "PA",
    },
  ],
  "ScannedCount": 1,
  "encodeCursor": [Function],
  "lastCursor": "{\\"pk1\\":\\"User#yay\\",\\"sk1\\":\\"User\\",\\"pk2\\":\\"User#CA\\",\\"sk2\\":\\"User#PA#scranton\\"}",
}
`);

  await expect(repo.delete({ id: "yay" })).resolves.toBe(true);

  await expect(repo.get({ id: "yay" })).resolves.toBeUndefined;
});

test("curosr pagination should work", async () => {
  const repo = getUserRepo();
  const cities = ["Alphaville", "Betaville", "Canaryville"];

  await Promise.all(
    cities.map((city) =>
      repo.put({
        id: city + "id",
        city,
        country: "DR",
        state: "Peravia",
        followers: [],
      })
    )
  );

  const where = {
    country: "DR",
    state: "Peravia",
  };

  const res = await repo.query("byCountryByStateByCity").where(where).exec();

  expect(res!.Items!.map((i) => i.city)).toMatchObject(cities);

  const page1 = await repo
    .query("byCountryByStateByCity")
    .where(where)
    .limit(1)
    .exec();

  expect(page1!.Items!.map((i) => i.city)).toMatchObject([cities[0]]);

  const page2 = await repo
    .query("byCountryByStateByCity")
    .where(where)
    .limit(2)
    .cursor(res.encodeCursor(res!.Items![0]))
    .exec();

  expect(page2!.Items!.map((i) => i.city)).toMatchObject([
    cities[1],
    cities[2],
  ]);

  const page3 = await repo
    .query("byCountryByStateByCity")
    .where(where)
    .limit(2)
    .cursor(res.encodeCursor(res!.Items![1]))
    .exec();

  expect(page3!.Items!.map((i) => i.city)).toMatchObject([cities[2]]);
});

const getWordRepo = () => {
  return new Repository(
    {
      schema: z.object({
        lang: z.string(),
        word: z.string(),
      }),
      primaryIndex: {
        fields: ["lang", "word"],
        tag: "primary",
        pk: "pk1",
        sk: "sk1",
      },
      tableName: "table1",
      typeName: "word",
    },
    ddb
  );
};

test("sort ascending/descending should work", async () => {
  const wordRepo = getWordRepo();
  await Promise.all([
    wordRepo.put({
      lang: "en",
      word: "a",
    }),
    wordRepo.put({
      lang: "en",
      word: "b",
    }),
    wordRepo.put({
      lang: "en",
      word: "c",
    }),
  ]);

  const { Items } = await wordRepo
    .query("primary")
    .where({ lang: "en" })
    .sort("desc")
    .exec();
  expect(Items).toMatchObject([{ word: "c" }, { word: "b" }, { word: "a" }]);

  const { Items: ItemsAscending } = await wordRepo
    .query("primary")
    .where({ lang: "en" })
    .sort("asc")
    .exec();
  expect(ItemsAscending).toMatchObject([
    { word: "a" },
    { word: "b" },
    { word: "c" },
  ]);
});

test("execAll should work", async () => {
  const wordRepo = getWordRepo();
  const res = await Promise.all([
    wordRepo.put({
      lang: "en",
      word: "a",
    }),
    wordRepo.put({
      lang: "en",
      word: "b",
    }),
    wordRepo.put({
      lang: "en",
      word: "c",
    }),
  ]);

  let i = 0;
  for await (const batch of wordRepo
    .query("primary")
    .limit(1)
    .where({ lang: "en" })
    .execAll()) {
    expect(res[i++]).toMatchObject(batch[0]);
  }
});

test("update should work", async () => {
  const repo = new Repository(
    {
      tableName: tableConfig.tableName,
      schema: z.object({
        id: z.string(),
        age: z.number().default(0),
        name: z.string(),
      }),
      typeName: "UserV5",
      primaryIndex: {
        fields: ["id"],
        ...tableConfig.primaryIndex,
      },
    },
    ddb
  );

  expect(
    await repo.putExpression(
      { id: "1" },
      {
        age: repo.expression.add(3),
        name: "jim",
      }
    )
  ).toEqual({
    id: "1",
    age: 3,
    name: "jim",
  });

  expect(
    await repo.putExpression(
      { id: "1" },
      {
        age: repo.expression.add(1),
        name: "meow",
      }
    )
  ).toEqual({
    id: "1",
    age: 4,
    name: "meow",
  });

  expect(
    await repo.putExpression(
      { id: "1" },
      {
        age: repo.expression.add(-4),
        name: "meow",
      }
    )
  ).toEqual({
    id: "1",
    age: 0,
    name: "meow",
  });
});

test("update should work with multiple add expressions", async () => {
  const repo = new Repository(
    {
      tableName: tableConfig.tableName,
      schema: z.object({
        id: z.string(),
        age: z.number(),
        faveNumber: z.number(),
        name: z.string(),
      }),
      typeName: "UserV5",
      primaryIndex: {
        fields: ["id"],
        ...tableConfig.primaryIndex,
      },
    },
    ddb
  );

  expect(
    await repo.putExpression(
      { id: "1" },
      {
        age: repo.expression.add(3),
        faveNumber: repo.expression.add(4),
        name: "jim",
      }
    )
  ).toEqual({
    id: "1",
    age: 3,
    faveNumber: 4,
    name: "jim",
  });

  expect(
    await repo.putExpression(
      { id: "1" },
      {
        age: repo.expression.add(1),
        faveNumber: 3,
        name: "meow",
      }
    )
  ).toEqual({
    id: "1",
    age: 4,
    faveNumber: 3,
    name: "meow",
  });

  expect(
    await repo.putExpression(
      { id: "1" },
      {
        age: repo.expression.add(-4),
        faveNumber: repo.expression.add(-4),
        name: "meow",
      }
    )
  ).toEqual({
    id: "1",
    age: 0,
    faveNumber: -1,
    name: "meow",
  });
});

test("query only return correct data", async () => {
  const repo = new Repository(
    {
      tableName: tableConfig.tableName,
      schema: z.object({
        id: z.string(),
        firstName: z.string(),
        lastName: z.string(),
      }),
      primaryIndex: {
        ...tableConfig.primaryIndex,
        fields: ["id"],
        tag: "id",
      },
      typeName: "users",
      secondaryIndexes: {
        "lastName,firstName": {
          ...tableConfig.secondaryIndexes[0],
          fields: ["lastName", "firstName"],
        },
      },
    },
    getDocumentClient()
  );

  await repo.put({
    id: "1",
    firstName: "joe",
    lastName: "meyer",
  });
  await repo.put({
    id: "2",
    firstName: "joeseph",
    lastName: "meyer",
  });

  await expect(
    repo
      .query("lastName,firstName")
      .where({
        lastName: "meyer",
        firstName: "joe",
      })
      .exec()
  ).resolves.toMatchObject({
    Items: [{ id: "1" }],
  });
});
