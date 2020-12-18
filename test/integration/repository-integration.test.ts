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
  repo = new Repository<UserId, User, 'primary' | 'byCountryByStateByCity'>(
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
          tag: 'byCountryByStateByCity',
          partitionKey: 'pk2',
          sortKey: 'sk2',
          fields: ['country', 'state', 'city'],
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
    country: 'CA',
    followers: [],
    state: 'PA',
  };

  await expect(repo.put(obj)).resolves.toEqual(obj);

  await expect(repo.get({ id: 'yay' })).resolves.toMatchInlineSnapshot(`
          Object {
            "city": "scranton",
            "country": "CA",
            "followers": Array [],
            "id": "yay",
            "pk1": "User#yay",
            "pk2": "User#CA",
            "sk1": "User",
            "sk2": "User#PA#scranton",
            "state": "PA",
          }
        `);

  await expect(() =>
    repo
      .query('primary')
      .where({ city: 'scranton' })
      .execute()
  ).toThrow();

  await expect(() =>
    repo
      .query('byCountryByStateByCity')
      .where({ city: 'scranton' })
      .execute()
  ).toThrow();

  await expect(
    repo
      .query('byCountryByStateByCity')
      .where({ country: 'CA' })
      .execute()
  ).resolves.toMatchInlineSnapshot(`
          Object {
            "Count": 1,
            "Items": Array [
              Object {
                "city": "scranton",
                "country": "CA",
                "followers": Array [],
                "id": "yay",
                "pk1": "User#yay",
                "pk2": "User#CA",
                "sk1": "User",
                "sk2": "User#PA#scranton",
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
            "country": "CA",
            "followers": Array [
              "yay1",
            ],
            "id": "yay",
            "pk1": "User#yay",
            "pk2": "User#CA",
            "sk1": "User",
            "sk2": "User#PA#scranton",
            "state": "PA",
          }
        `);

  await expect(() =>
    repo.updateUnsafe({ id: 'NON_EXISTANT_ID' }, { followers: ['YAY'] })
  ).rejects;

  await expect(
    repo
      .query('byCountryByStateByCity')
      .where({ country: 'CA' })
      .execute()
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
                "pk1": "User#yay",
                "pk2": "User#CA",
                "sk1": "User",
                "sk2": "User#PA#scranton",
                "state": "PA",
              },
            ],
            "ScannedCount": 1,
            "encodeCursor": [Function],
          }
        `);

  await expect(repo.delete({ id: 'yay' })).resolves.toBe(true);

  await expect(repo.get({ id: 'yay' })).resolves.toBeUndefined;
});

test('curosr pagination should work', async () => {
  const cities = ['Alphaville', 'Betaville', 'Canaryville'];

  await Promise.all(
    cities.map(city =>
      repo.put({
        id: city + 'id',
        city,
        country: 'DR',
        state: 'Peravia',
        followers: [],
      })
    )
  );

  const where = {
    country: 'DR',
    state: 'Peravia',
  };

  const res = await repo
    .query('byCountryByStateByCity')
    .where(where)
    .execute();

  expect(res!.Items!.map(i => i.city)).toMatchObject(cities);

  const page1 = await repo
    .query('byCountryByStateByCity')
    .where(where)
    .limit(1)
    .execute();

  expect(page1!.Items!.map(i => i.city)).toMatchObject([cities[0]]);

  const page2 = await repo
    .query('byCountryByStateByCity')
    .where(where)
    .limit(2)
    .cursor(res.encodeCursor(res!.Items![0]))
    .execute();

  expect(page2!.Items!.map(i => i.city)).toMatchObject([cities[1], cities[2]]);

  const page3 = await repo
    .query('byCountryByStateByCity')
    .where(where)
    .limit(2)
    .cursor(res.encodeCursor(res!.Items![1]))
    .execute();
  
  expect(page3!.Items!.map(i => i.city)).toMatchObject([cities[2]]);
});
