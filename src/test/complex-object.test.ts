import { InferIdType, InferObjectType, Repository } from '../repository';
import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import {
  array,
  object,
  string,
  size,
  enums,
  union,
  literal,
  number,
  pattern,
  trimmed,
} from 'superstruct';

import { tableConfig } from './utils/table_config';

enum Role {
  Admin = 'Admin',
  Peasant = 'Peasant',
}

enum Sport {
  Football = 'Football',
  Basketball = 'Basketball',
}

enum Craft {
  Pottery = 'Pottery',
  Knitting = 'Knitting',
}

const schema = object({
  id: string(),
  bio: trimmed(string()),
  role: enums(Object.values(Role)),
  email: size(trimmed(pattern(string(), /\S+@\S+\.\S+/)), 5, 100),
  age: size(number(), 0, 120),
  hobbies: array(
    union([
      object({
        type: literal('sport'),
        sportName: enums(Object.values(Sport)),
      }),
      object({
        type: literal('craft'),
        craftName: enums(Object.values(Craft)),
        materialsNeeded: array(string()),
      }),
    ])
  ),
});

const ddb = new DocumentClient({
  ...(process.env.MOCK_DYNAMODB_ENDPOINT && {
    endpoint: process.env.MOCK_DYNAMODB_ENDPOINT,
    sslEnabled: false,
    region: 'local',
  }),
});

const repo = new Repository(
  {
    typeName: 'User',

    schema,

    tableName: 'table1',

    primaryIndex: {
      ...tableConfig.primaryIndex,
      fields: ['id'],
    },

  },
  ddb
);

type O = InferObjectType<typeof repo>;
type Id = InferIdType<typeof repo>;

function getDefault() {
  return {
    id: 'asdfasdf',
    age: 119,
    bio: '  Meeeeooowww \n \n \r \t ',
    email: 'jeffy@yay.com',
    hobbies: [],
    role: Role.Admin,
  };
}

test('trim should work', async () => {
  const res = await repo.put(getDefault());

  expect(res.bio).toBe('Meeeeooowww');

  await expect(() =>
    repo.updateUnsafe(
      { id: res.id },
      {
        age: 121,
      }
    )
  ).rejects.toMatchInlineSnapshot(
    `[StructError: At path: age -- Expected a number between \`0\` and \`120\` but received \`121\`]`
  );
});

test('regex validation should work', async () => {
  expect(() =>
    repo.put({
      ...getDefault(),
      email: 'not a email',
    })
  ).rejects.toMatchInlineSnapshot(
    `[StructError: At path: email -- Expected a string matching \`/\\S+@\\S+\\.\\S+/\` but received "not a email"]`
  );
});

test('union should work', async () => {
  const res = await repo.put({
    ...getDefault(),
    hobbies: [
      {
        type: 'craft',
        craftName: Craft.Knitting,
        materialsNeeded: ['yarn'],
      },
      {
        type: 'sport',
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
