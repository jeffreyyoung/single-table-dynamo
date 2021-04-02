import { Repository } from '../../repository';
import { batchWrite } from '../../batch-write';
import { batchGet } from '../../batch-get';
import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import { object, string } from 'superstruct';
import sinon from 'sinon';

const ddb = new DocumentClient({
  ...(process.env.MOCK_DYNAMODB_ENDPOINT && {
    endpoint: process.env.MOCK_DYNAMODB_ENDPOINT,
    sslEnabled: false,
    region: 'local',
  }),
});

test('hooks should get called', async () => {
  const spies = {
    get: sinon.spy(),
    delete: sinon.spy(),
    put: sinon.spy(),
    query: sinon.spy(),
    updateUnsafe: sinon.spy(),
  };
  const thingRepo = new Repository(
    {
      schema: object({
        id: string(),
        name: string(),
      }),
      tableName: 'table1',
      typeName: 'Thing',
      primaryIndex: {
        tag: 'primary',
        pk: 'pk1',
        sk: 'sk1',
        fields: ['id'],
      },
      on: spies,
    },
    ddb
  );

  await thingRepo.put({ id: '1', name: 'meow' });
  await thingRepo.get({ id: '1' });
  await thingRepo.updateUnsafe({ id: '1' }, { id: '1', name: 'yeehaw' });
  await thingRepo.get({ id: '1' });
  await thingRepo.delete({ id: '1' });
  await thingRepo.get({ id: '1' });

  expect(spies.put.getCalls().map(c => c.args)).toMatchInlineSnapshot(`
    Array [
      Array [
        Array [
          Object {
            "id": "1",
            "name": "meow",
          },
        ],
        Object {
          "id": "1",
          "name": "meow",
        },
        Object {
          "Key": Object {
            "pk1": "Thing#1",
            "sk1": "Thing",
          },
          "TableName": "table1",
        },
      ],
    ]
  `);
  expect(spies.get.getCalls().map(c => c.args)).toMatchInlineSnapshot(`
    Array [
      Array [
        Array [
          Object {
            "id": "1",
          },
          Object {
            "fieldsToProject": Array [
              "id",
              "name",
            ],
          },
        ],
        Object {
          "id": "1",
          "name": "meow",
        },
        Object {
          "Key": Object {
            "pk1": "Thing#1",
            "sk1": "Thing",
          },
          "TableName": "table1",
        },
      ],
      Array [
        Array [
          Object {
            "id": "1",
          },
          Object {
            "fieldsToProject": Array [
              "id",
              "name",
            ],
          },
        ],
        Object {
          "id": "1",
          "name": "yeehaw",
        },
        Object {
          "Key": Object {
            "pk1": "Thing#1",
            "sk1": "Thing",
          },
          "TableName": "table1",
        },
      ],
      Array [
        Array [
          Object {
            "id": "1",
          },
          Object {
            "fieldsToProject": Array [
              "id",
              "name",
            ],
          },
        ],
        null,
        Object {
          "Key": Object {
            "pk1": "Thing#1",
            "sk1": "Thing",
          },
          "TableName": "table1",
        },
      ],
    ]
  `);
  expect(spies.updateUnsafe.getCalls().map(c => c.args)).toMatchInlineSnapshot(`
    Array [
      Array [
        Array [
          Object {
            "id": "1",
          },
          Object {
            "id": "1",
            "name": "yeehaw",
          },
          Object {
            "upsert": false,
          },
        ],
        Object {
          "id": "1",
          "name": "yeehaw",
          "pk1": "Thing#1",
          "sk1": "Thing",
        },
        Object {
          "Key": Object {
            "pk1": "Thing#1",
            "sk1": "Thing",
          },
          "TableName": "table1",
        },
      ],
    ]
  `);
  expect(spies.delete.getCalls().map(c => c.args)).toMatchInlineSnapshot(`
    Array [
      Array [
        Array [
          Object {
            "id": "1",
          },
        ],
        true,
        Object {
          "Key": Object {
            "pk1": "Thing#1",
            "sk1": "Thing",
          },
          "TableName": "table1",
        },
      ],
    ]
  `);
});
