import { Repository } from './../../src/repository';
import { DocumentClient } from 'aws-sdk/clients/dynamodb';

type UserId = {
  id: string;
};

type User = UserId & {
  followers: string[];
  country: string;
  city: string;
  state: string;
};
let repo: Repository<UserId, User>;

beforeEach(() => {
  repo = new Repository<UserId, User>(
    {
      tableName: 'table1',
      typeName: 'User',
      primaryIndex: {
        tag: 'primary',
        partitionKey: 'pk1',
        sortKey: 'sk1',
        fields: ['id'],
      },
      secondaryIndexes: [
        {
          tag: 'byStateByCityByCountry',
          partitionKey: 'pk2',
          sortKey: 'sk2',
          fields: ['state', 'city', 'country'],
          indexName: 'gsi1',
        },
      ],
    },
    new DocumentClient({
      ...(process.env.MOCK_DYNAMODB_ENDPOINT && {
        endpoint: process.env.MOCK_DYNAMODB_ENDPOINT,
        sslEnabled: false,
        region: 'local',
      }),
    })
  );
});

test('get, put, delete, updateUnsafe, and query should work', async () => {
  await expect(repo.get({ id: 'yay' })).resolves.toEqual(undefined);

  const obj = {
    id: 'yay',
    city: 'scranton',
    country: 'USA',
    followers: [],
    state: 'PA',
  };

  await expect(repo.put(obj)).resolves.toEqual(obj);

  await expect(repo.get({ id: 'yay' })).resolves.toEqual({
    ...obj,
    pk1: 'User#yay',
    pk2: 'User#PA',
    sk1: 'User',
    sk2: 'User#scranton#USA',
  });

  await expect(() =>
    repo
      .query('primary')
      .where({ city: 'scranton' })
      .execute()
  ).toThrow();

  await expect(() =>
    repo
      .query('byStateByCityByCountry')
      .where({ city: 'scranton' })
      .execute()
  ).toThrow();

  await expect(
    repo
      .query('byStateByCityByCountry')
      .where({ state: 'PA' })
      .execute()
  ).resolves.toMatchInlineSnapshot(`
          Object {
            "Count": 1,
            "Items": Array [
              Object {
                "city": "scranton",
                "country": "USA",
                "followers": Array [],
                "id": "yay",
                "pk1": "User#yay",
                "pk2": "User#PA",
                "sk1": "User",
                "sk2": "User#scranton#USA",
                "state": "PA",
              },
            ],
            "ScannedCount": 1,
            "encodeCursor": [Function],
          }
        `);

  await expect(repo.updateUnsafe({ id: obj.id }, { followers: ['yay1'] }))
    .resolves.toMatchInlineSnapshot(`
          Object {
            "city": "scranton",
            "country": "USA",
            "followers": Array [
              "yay1",
            ],
            "id": "yay",
            "pk1": "User#yay",
            "pk2": "User#PA",
            "sk1": "User",
            "sk2": "User#scranton#USA",
            "state": "PA",
          }
        `);

  await expect(() => repo.updateUnsafe({id: 'NON_EXISTANT_ID'}, { followers: ['YAY']}))
    .rejects;

  await expect(
    repo
      .query('byStateByCityByCountry')
      .where({ state: 'PA' })
      .execute()
  ).resolves.toMatchInlineSnapshot(`
          Object {
            "Count": 1,
            "Items": Array [
              Object {
                "city": "scranton",
                "country": "USA",
                "followers": Array [
                  "yay1",
                ],
                "id": "yay",
                "pk1": "User#yay",
                "pk2": "User#PA",
                "sk1": "User",
                "sk2": "User#scranton#USA",
                "state": "PA",
              },
            ],
            "ScannedCount": 1,
            "encodeCursor": [Function],
          }
        `);
    
    await expect(
      repo.delete({id: 'yay'})
    ).resolves.toBe(true);

    await expect(
      repo.get({id: 'yay'})
    ).resolves.toBeUndefined
});
