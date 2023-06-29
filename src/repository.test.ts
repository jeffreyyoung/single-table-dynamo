import { Repository } from "./repository";
import { z } from "zod";
import { getDocumentClient } from "./test/utils/getDocumentClient";
import { tableConfig } from "./test/utils/tableConfig";
const ddb = getDocumentClient();

const getUserRepo = () =>
  new Repository({
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
    documentClient: ddb,
  });

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

test("upsert mode works as expected", async () => {
  const repo = getUserRepo();

  await expect(
    repo.put(
      {
        city: "gump",
        state: "forest",
        country: "vietnam",
        followers: [],
        id: "5",
      },

      { mode: "upsert" }
    )
  ).resolves.toMatchInlineSnapshot(`
Object {
  "city": "gump",
  "country": "vietnam",
  "followers": Array [],
  "id": "5",
  "state": "forest",
}
`);

  await expect(
    repo.put(
      {
        city: "gump",
        state: "forest",
        country: "vietnam",
        followers: [],
        id: "5",
      },

      { mode: "upsert" }
    )
  ).resolves.toMatchInlineSnapshot(`
Object {
  "city": "gump",
  "country": "vietnam",
  "followers": Array [],
  "id": "5",
  "state": "forest",
}
`);
});

test("update mode works as expected", async () => {
  const repo = getUserRepo();

  await expect(() =>
    repo.put(
      {
        city: "gump",
        state: "forest",
        country: "vietnam",
        followers: [],
        id: "5",
      },

      { mode: "update" }
    )
  ).rejects.toMatchInlineSnapshot(
    `[single-table-Error: There was an error putting User]`
  );

  await expect(
    repo.put({
      city: "gump",
      state: "forest",
      country: "vietnam",
      followers: [],
      id: "5",
    })
  ).resolves.toMatchInlineSnapshot(`
Object {
  "city": "gump",
  "country": "vietnam",
  "followers": Array [],
  "id": "5",
  "state": "forest",
}
`);

  await expect(
    repo.put(
      {
        city: "gump",
        state: "forest",
        country: "yeehaw",
        followers: [],
        id: "5",
      },

      { mode: "update" }
    )
  ).resolves.toMatchInlineSnapshot(`
Object {
  "city": "gump",
  "country": "yeehaw",
  "followers": Array [],
  "id": "5",
  "state": "forest",
}
`);
});

test("create mode works as expected", async () => {
  const repo = getUserRepo();

  await expect(
    repo.put(
      {
        city: "gump",
        state: "forest",
        country: "vietnam",
        followers: [],
        id: "5",
      },

      { mode: "create" }
    )
  ).resolves.toMatchInlineSnapshot(`
Object {
  "city": "gump",
  "country": "vietnam",
  "followers": Array [],
  "id": "5",
  "state": "forest",
}
`);

  await expect(() =>
    repo.put(
      {
        city: "gump",
        state: "forest",
        country: "vietnam",
        followers: [],
        id: "5",
      },
      { mode: "create" }
    )
  ).rejects.toMatchObject({
    message: "There was an error putting User",
    cause: {
      message: "The conditional request failed",
    },
  });
});

test("works as expected", async () => {
  const repo = new Repository({
    ...getUserRepo().args,
    documentClient: ddb,
  });

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

test("get, put, delete, merge, and query should work", async () => {
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
  "hasNextPage": false,
  "lastCursor": undefined,
}
`);

  await expect(repo.mutate({ id: obj.id, followers: ["yay1"] })).resolves
    .toMatchInlineSnapshot(`
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

  await expect(() => repo.mutate({ id: "NON_EXISTANT_ID", followers: ["YAY"] }))
    .rejects;

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
  "hasNextPage": false,
  "lastCursor": undefined,
}
`);

  await expect(repo.delete({ id: "yay" })).resolves.toBe(true);

  await expect(repo.get({ id: "yay" })).resolves.toBeUndefined;
});

test("note repo works as expected", async () => {
  const repo = new Repository({
    tableName: tableConfig.tableName,
    typeName: "Note",
    schema: z.object({
      _v: z.literal("1").default("1"),
      authorId: z.string(),
      communityId: z.string(),
      createdAt: z.string().default(() => new Date().toISOString()),
      expiresAt: z.string().default(() => new Date().toISOString()),
      text: z.string().max(100),
    }),
    primaryIndex: {
      tag: "authorId,communityId,noteId",
      fields: ["authorId", "communityId", "createdAt"],
      ...tableConfig.primaryIndex,
    },
    documentClient: getDocumentClient(),
  });

  await expect(
    repo.put({
      authorId: "1",
      communityId: "2",
      text: "yay",
    })
  ).resolves.toMatchObject({
    _v: "1",
    authorId: "1",
    communityId: "2",
    createdAt: expect.any(String),
    expiresAt: expect.any(String),
    text: "yay",
  });
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
  return new Repository({
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
    documentClient: ddb,
  });
};

test("merge should throw if not exists", async () => {
  const repo = getWordRepo();

  await expect(() =>
    repo.merge({
      lang: "en",
      word: "hello",
    })
  ).rejects.toMatchInlineSnapshot(
    `[single-table-Error: Cannot merge into item that does not exist]`
  );
});

test("merge should writ if not exists", async () => {
  const repo = getWordRepo();

  await expect(
    repo.merge(
      {
        lang: "en",
        word: "hello",
      },
      {
        objectToPutIfNotExists: {
          lang: "en",
          word: "meow",
        },
      }
    )
  ).resolves.toMatchObject({
    lang: "en",
    word: "meow",
  });
});

test("merge should work", async () => {
  const repo = getUserRepo();

  const obj = await repo.put({
    id: "yay",
    state: "PA",
    city: "scranton",
    country: "USA",
    followers: [],
  });

  await expect(
    repo.merge({
      id: "yay",
      followers: ["yay1"],
    })
  ).resolves.toMatchObject({
    id: "yay",
    state: "PA",
    city: "scranton",
    country: "USA",
    followers: ["yay1"],
  });

  await expect(
    repo.merge(
      {
        id: "yay",
        followers: ["yay2"],
      },
      {
        objectToPutIfNotExists: {
          id: "yay",
          state: "PA",
          city: "scranton",
          country: "USA",
          followers: [],
        },
      }
    )
  ).resolves.toMatchObject({
    id: "yay",
    state: "PA",
    city: "scranton",
    country: "USA",
    followers: ["yay2"],
  });
});

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

  expect(i).toBe(3);
});

test("execAll should work with sort", async () => {
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

  const iter = wordRepo
    .query("primary")
    .where({ lang: "en" })
    .sort("desc")
    .limit(1)
    .execAll();

  await expect(iter.next()).resolves.toMatchObject({
    done: false,
    value: [{ word: "c" }],
  });
  await expect(iter.next()).resolves.toMatchObject({
    done: false,
    value: [{ word: "b" }],
  });
  await expect(iter.next()).resolves.toMatchObject({
    done: false,
    value: [{ word: "a" }],
  });
  await expect(iter.next()).resolves.toMatchObject({
    done: true,
    value: undefined,
  });
  await expect(iter.next()).resolves.toMatchObject({
    done: true,
    value: undefined,
  });
});

test("update should work", async () => {
  const repo = new Repository({
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
    documentClient: ddb,
  });

  expect(
    await repo.putExpression({
      id: "1",
      age: repo.expression.add(3),
      name: "jim",
    })
  ).toEqual({
    id: "1",
    age: 3,
    name: "jim",
  });

  expect(
    await repo.putExpression({
      id: "1",
      age: repo.expression.add(1),
      name: "meow",
    })
  ).toEqual({
    id: "1",
    age: 4,
    name: "meow",
  });

  expect(
    await repo.putExpression({
      id: "1",
      age: repo.expression.add(-4),
      name: "meow",
    })
  ).toEqual({
    id: "1",
    age: 0,
    name: "meow",
  });
});

test("putExpression with mode = update should work", async () => {
  const repo = new Repository({
    tableName: tableConfig.tableName,
    schema: z.object({
      id: z.string(),
      age: z.number(),
    }),
    typeName: "UserV9",
    primaryIndex: {
      fields: ["id"],
      ...tableConfig.primaryIndex,
    },
    documentClient: ddb,
  });

  await expect(() =>
    repo.putExpression(
      { age: repo.expression.add(1), id: "1" },
      { mode: "update" }
    )
  ).rejects.toMatchInlineSnapshot(
    `[ConditionalCheckFailedException: The conditional request failed]`
  );

  await expect(
    repo.putExpression(
      { age: repo.expression.add(1), id: "1" },
      { mode: "create" }
    )
  ).resolves.toMatchInlineSnapshot(`
Object {
  "age": 1,
  "id": "1",
}
`);

  await expect(() =>
    repo.putExpression(
      { age: repo.expression.add(1), id: "1" },
      { mode: "create" }
    )
  ).rejects.toMatchInlineSnapshot(
    `[ConditionalCheckFailedException: The conditional request failed]`
  );

  await expect(
    repo.putExpression(
      { age: repo.expression.add(1), id: "1" },
      { mode: "update" }
    )
  ).resolves.toMatchInlineSnapshot(`
  Object {
    "age": 2,
    "id": "1",
  }
  `);

  await expect(
    repo.putExpression(
      { age: repo.expression.add(1), id: "1" },
      { mode: "upsert" }
    )
  ).resolves.toMatchInlineSnapshot(`
Object {
  "age": 3,
  "id": "1",
}
`);
});

test("update should work with multiple add expressions", async () => {
  const repo = new Repository({
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
    documentClient: ddb,
  });

  expect(
    await repo.putExpression({
      id: "1",
      age: repo.expression.add(3),
      faveNumber: repo.expression.add(4),
      name: "jim",
    })
  ).toEqual({
    id: "1",
    age: 3,
    faveNumber: 4,
    name: "jim",
  });

  expect(
    await repo.putExpression({
      id: "1",
      age: repo.expression.add(1),
      faveNumber: 3,
      name: "meow",
    })
  ).toEqual({
    id: "1",
    age: 4,
    faveNumber: 3,
    name: "meow",
  });

  expect(
    await repo.putExpression({
      id: "1",
      age: repo.expression.add(-4),
      faveNumber: repo.expression.add(-4),
      name: "meow",
    })
  ).toEqual({
    id: "1",
    age: 0,
    faveNumber: -1,
    name: "meow",
  });
});

test("query only return correct data", async () => {
  const repo = new Repository({
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
    documentClient: getDocumentClient(),
  });

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

test("generated ids should work", () => {
  const repo = new Repository({
    typeName: "thingy",
    schema: z.object({
      id: z.string().default(() => "yay"),
    }),
    primaryIndex: {
      fields: ["id"],
      ...tableConfig.primaryIndex,
    },

    tableName: tableConfig.tableName,

    documentClient: getDocumentClient(),
  });

  expect(repo.put({})).resolves.toMatchInlineSnapshot(`
Object {
  "id": "yay",
}
`);
});

test("query on primary index works", async () => {
  const repo = new Repository({
    typeName: "thingy",
    schema: z.object({
      first: z.string().default(() => "henry"),
      last: z.string().default(() => "jacobs"),
    }),
    primaryIndex: {
      fields: ["last", "first"],
      tag: "last,first",
      ...tableConfig.primaryIndex,
    },

    tableName: tableConfig.tableName,

    documentClient: getDocumentClient(),
  });

  await repo.putMany([
    { first: "a", last: "jacobs" },
    { first: "b", last: "jacobs" },
    { first: "c", last: "jac" },
  ]);

  expect(repo.query("last,first").where({ last: "jacobs" }).exec()).resolves
    .toMatchInlineSnapshot(`
Object {
  "Count": 2,
  "Items": Array [
    Object {
      "first": "a",
      "last": "jacobs",
    },
    Object {
      "first": "b",
      "last": "jacobs",
    },
  ],
  "ScannedCount": 2,
  "encodeCursor": [Function],
  "hasNextPage": false,
  "lastCursor": undefined,
}
`);

  expect(repo.query("last,first").where({ last: "jac" }).exec()).resolves
    .toMatchInlineSnapshot(`
Object {
  "Count": 1,
  "Items": Array [
    Object {
      "first": "c",
      "last": "jac",
    },
  ],
  "ScannedCount": 1,
  "encodeCursor": [Function],
  "hasNextPage": false,
  "lastCursor": undefined,
}
`);
});

test("generated ids should work with secondary indexes", () => {
  const repo = new Repository({
    typeName: "thingy",
    schema: z.object({
      id: z.string().default(() => "yay"),
      name: z.string().default(() => "jim"),
    }),
    primaryIndex: {
      fields: ["id"],
      ...tableConfig.primaryIndex,
    },

    secondaryIndexes: {
      name: {
        fields: ["name"],
        ...tableConfig.secondaryIndexes[1],
      },
    },

    tableName: tableConfig.tableName,

    documentClient: getDocumentClient(),
  });

  expect(repo.put({})).resolves.toMatchInlineSnapshot(`
Object {
  "id": "yay",
  "name": "jim",
}
`);
});
