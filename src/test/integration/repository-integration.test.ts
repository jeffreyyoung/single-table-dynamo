import { Repository } from '../../repository';
import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import { array, object, string } from 'superstruct';

const getUserRepo = () => new Repository({
  tableName: 'table1',
  entityType: 'User',
  schema: object({
    id: string(),
    followers: array(string()),
    country: string(),
    city: string(),
    state: string()
  }),
  primaryIndex: {
    tag: 'primary',
    pk: 'pk1',
    sk: 'sk1',
    fields: ['id']
  },
  secondaryIndexes: {
    byCountryByStateByCity: {
      pk: 'pk2',
      sk: 'sk2',
      fields: ['country', 'state', 'city'],
      indexName: 'gsi1',
    }
  }
}, new DocumentClient({
  ...(process.env.MOCK_DYNAMODB_ENDPOINT && {
    endpoint: process.env.MOCK_DYNAMODB_ENDPOINT,
    sslEnabled: false,
    region: 'local',
  }),
}))

test('get, put, delete, updateUnsafe, and query should work', async () => {
  const repo = getUserRepo();
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
      .exec()
  ).toThrow();

  await expect(() =>
    repo
      .query('byCountryByStateByCity')
      .where({ city: 'scranton' })
      .exec()
  ).toThrow();

  await expect(
    repo
      .query('byCountryByStateByCity')
      .where({ country: 'CA' })
      .exec()
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
      .exec()
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
  const repo = getUserRepo();
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
    .exec();

  expect(res!.Items!.map(i => i.city)).toMatchObject(cities);

  const page1 = await repo
    .query('byCountryByStateByCity')
    .where(where)
    .limit(1)
    .exec();

  expect(page1!.Items!.map(i => i.city)).toMatchObject([cities[0]]);

  const page2 = await repo
    .query('byCountryByStateByCity')
    .where(where)
    .limit(2)
    .cursor(res.encodeCursor(res!.Items![0]))
    .exec();

  expect(page2!.Items!.map(i => i.city)).toMatchObject([cities[1], cities[2]]);

  const page3 = await repo
    .query('byCountryByStateByCity')
    .where(where)
    .limit(2)
    .cursor(res.encodeCursor(res!.Items![1]))
    .exec();
  
  expect(page3!.Items!.map(i => i.city)).toMatchObject([cities[2]]);
});
