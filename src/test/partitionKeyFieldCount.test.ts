import { object, string } from 'superstruct';
import { Repository } from '../repository';
import { getDocumentClient } from './utils/getDocumentClient';
import { tableConfig } from './utils/table_config';

const repository = new Repository(
  {
    schema: object({
      state: string(),
      country: string(),
      createdAt: string(),
    }),
    tableName: tableConfig.tableName,
    typeName: 'User',
    primaryIndex: {
      ...tableConfig.primaryIndex,
      tag: 'byCountryByState',
      fields: ['country', 'state', 'createdAt'],
      partitionKeyFieldCount: 2,
    },
  },
  getDocumentClient()
);

const mapper = repository.mapper;

test('should format object for dynamodb properly', () => {
  expect(
    mapper.decorateWithKeys({
      createdAt: 'yesterday',
      country: 'USA',
      state: 'WA',
    })
  ).toEqual({
    createdAt: 'yesterday',
    country: 'USA',
    state: 'WA',

    pk1: 'User#USA#WA',
    sk1: 'User#yesterday',
  });

  expect(
    mapper.decorateWithKeys({
      createdAt: 'tomorrow',
      country: 'USA',
      state: 'UT',
    })
  ).toEqual({
    createdAt: 'tomorrow',
    country: 'USA',
    state: 'UT',

    pk1: 'User#USA#UT',
    sk1: 'User#tomorrow',
  });
});

test('should format partial index properly', () => {
  expect(
    mapper.getIndexKey(
      { country: 'USA', state: 'UT' },
      mapper.args.primaryIndex,
      { partial: true }
    )
  ).toEqual({
    pk1: 'User#USA#UT',
    sk1: 'User',
  });
});

test('should throw when not all partition keys are provided', () => {
  expect(() =>
    mapper.getIndexKey({ country: 'USA' }, mapper.args.primaryIndex, {
      partial: true,
    })
  ).toThrow();
});

test('query should work', async () => {
  await expect(
    Promise.all([
      repository.put({
        country: 'USA',
        state: 'WA',
        createdAt: '1990',
      }),
      repository.put({
        country: 'USA',
        state: 'WA',
        createdAt: '1991',
      }),
      repository.put({
        country: 'USA',
        state: 'UT',
        createdAt: '1990',
      }),
    ])
  ).resolves.toMatchInlineSnapshot(`
          Array [
            Object {
              "country": "USA",
              "createdAt": "1990",
              "state": "WA",
            },
            Object {
              "country": "USA",
              "createdAt": "1991",
              "state": "WA",
            },
            Object {
              "country": "USA",
              "createdAt": "1990",
              "state": "UT",
            },
          ]
        `);

  await expect(
    repository
      .query('byCountryByState')
      .where({
        state: 'WA',
        country: 'USA',
      })
      .exec()
  ).resolves.toMatchInlineSnapshot(`
          Object {
            "Count": 2,
            "Items": Array [
              Object {
                "country": "USA",
                "createdAt": "1990",
                "state": "WA",
              },
              Object {
                "country": "USA",
                "createdAt": "1991",
                "state": "WA",
              },
            ],
            "ScannedCount": 2,
            "encodeCursor": [Function],
          }
        `);

  await expect(
    repository
      .query('byCountryByState')
      .where({
        state: 'UT',
        country: 'USA',
      })
      .exec()
  ).resolves.toMatchInlineSnapshot(`
          Object {
            "Count": 1,
            "Items": Array [
              Object {
                "country": "USA",
                "createdAt": "1990",
                "state": "UT",
              },
            ],
            "ScannedCount": 1,
            "encodeCursor": [Function],
          }
        `);
});

test('should work when partitionKeyFieldCount > fields.length', async () => {
  const repository = new Repository(
    {
      schema: object({
        state: string(),
        country: string(),
        createdAt: string(),
      }),
      tableName: tableConfig.tableName,
      typeName: 'User1',
      primaryIndex: {
        ...tableConfig.primaryIndex,
        tag: 'pk',
        fields: ['country', 'state', 'createdAt'],
        partitionKeyFieldCount: 100,
      },
    },
    getDocumentClient()
  );

  expect(
    repository.mapper.decorateWithKeys({
      state: 'UT',
      country: 'USA',
      createdAt: '1990',
    })
  ).toMatchInlineSnapshot(`
    Object {
      "country": "USA",
      "createdAt": "1990",
      "pk1": "User1#USA#UT#1990",
      "sk1": "User1",
      "state": "UT",
    }
  `);

  await expect(
    repository.put({
      state: 'UT',
      country: 'USA',
      createdAt: '1990',
    })
  ).resolves.toMatchInlineSnapshot(`
          Object {
            "country": "USA",
            "createdAt": "1990",
            "state": "UT",
          }
        `);

  await expect(
    repository.get({
      state: 'UT',
      country: 'USA',
      createdAt: '1990',
    })
  ).resolves.toMatchInlineSnapshot(`
          Object {
            "country": "USA",
            "createdAt": "1990",
            "state": "UT",
          }
        `);

  await expect(
    repository.get({
      state: 'UT',
      country: 'USA',
      createdAt: 'NEVER',
    })
  ).resolves.toMatchInlineSnapshot(`null`);

  await expect(() =>
    repository
      .query('pk')
      .where({ state: 'UT' })
      .exec()
  ).toThrowErrorMatchingInlineSnapshot(
    `"To query index: {\\"pk\\":\\"pk1\\",\\"sk\\":\\"sk1\\",\\"tag\\":\\"pk\\",\\"fields\\":[\\"country\\",\\"state\\",\\"createdAt\\"],\\"partitionKeyFieldCount\\":100}, field: country is required, recieved {\\"state\\":\\"UT\\"}, debugInfo: {}"`
  );

  await expect(
    repository
      .query('pk')
      .where({ state: 'UT', country: 'USA', createdAt: '1990' })
      .exec()
  ).resolves.toMatchInlineSnapshot(`
          Object {
            "Count": 1,
            "Items": Array [
              Object {
                "country": "USA",
                "createdAt": "1990",
                "state": "UT",
              },
            ],
            "ScannedCount": 1,
            "encodeCursor": [Function],
          }
        `);
});
