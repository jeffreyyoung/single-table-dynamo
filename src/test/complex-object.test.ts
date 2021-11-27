import { InferIdType, InferObjectType, Repository } from "../repository";
import { DocumentClient } from "aws-sdk/clients/dynamodb";
import { z } from "zod";
import { tableConfig } from "./utils/table_config";

enum Role {
  Admin = "Admin",
  Peasant = "Peasant",
}

enum Sport {
  Football = "Football",
  Basketball = "Basketball",
}

enum Craft {
  Pottery = "Pottery",
  Knitting = "Knitting",
}

const schema = z.object({
  id: z.string(),
  bio: z.string().transform((str) => str.trim()),
  role: z.nativeEnum(Role),
  email: z.string().email().min(5).max(100),
  age: z.number().min(0).max(120),
  hobbies: z.array(
    z.union([
      z.object({
        type: z.literal("sport"),
        sportName: z.nativeEnum(Sport),
      }),
      z.object({
        type: z.literal("craft"),
        craftName: z.nativeEnum(Craft),
        materialsNeeded: z.array(z.string()),
      }),
    ])
  ),
});

const ddb = new DocumentClient({
  ...(process.env.MOCK_DYNAMODB_ENDPOINT && {
    endpoint: process.env.MOCK_DYNAMODB_ENDPOINT,
    sslEnabled: false,
    region: "local",
  }),
});

const repo = new Repository(
  {
    typeName: "User",

    schema,

    tableName: "table1",

    primaryIndex: {
      ...tableConfig.primaryIndex,
      fields: ["id"],
    },
  },
  ddb
);

type O = InferObjectType<typeof repo>;
type Id = InferIdType<typeof repo>;

function getDefault() {
  return {
    id: "asdfasdf",
    age: 119,
    bio: "  Meeeeooowww \n \n \r \t ",
    email: "jeffy@yay.com",
    hobbies: [],
    role: Role.Admin,
  };
}

test("trim should work", async () => {
  const res = await repo.put(getDefault());

  expect(res.bio).toBe("Meeeeooowww");

  await expect(() =>
    repo.updateUnsafe(
      { id: res.id },
      {
        age: 121,
      }
    )
  ).rejects.toMatchInlineSnapshot(`
[ZodError: [
  {
    "code": "too_big",
    "maximum": 120,
    "type": "number",
    "inclusive": true,
    "message": "Value should be less than or equal to 120",
    "path": [
      "age"
    ]
  }
]]
`);
});

test("regex validation should work", async () => {
  expect(() =>
    repo.put({
      ...getDefault(),
      email: "not a email",
    })
  ).rejects.toMatchInlineSnapshot(`
[ZodError: [
  {
    "validation": "email",
    "code": "invalid_string",
    "message": "Invalid email",
    "path": [
      "email"
    ]
  }
]]
`);
});

test("union should work", async () => {
  const res = await repo.put({
    ...getDefault(),
    hobbies: [
      {
        type: "craft",
        craftName: Craft.Knitting,
        materialsNeeded: ["yarn"],
      },
      {
        type: "sport",
        sportName: Sport.Basketball,
      },
    ],
  });

  expect(res).toMatchInlineSnapshot(`
    Object {
      "age": 119,
      "bio": "Meeeeooowww",
      "email": "jeffy@yay.com",
      "hobbies": Array [
        Object {
          "craftName": "Knitting",
          "materialsNeeded": Array [
            "yarn",
          ],
          "type": "craft",
        },
        Object {
          "sportName": "Basketball",
          "type": "sport",
        },
      ],
      "id": "asdfasdf",
      "role": "Admin",
    }
  `);
});
