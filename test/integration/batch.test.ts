import { Repository } from '../../src/repository';
import { batchWrite } from '../../src/batch-write';
import { batchGet } from '../../src/batch-get';
import { DocumentClient } from 'aws-sdk/clients/dynamodb';

type ThingId = {
  id: string;
};

type Thing = ThingId & {
  name: string
};
let repo: Repository<ThingId, Thing>;

beforeEach(() => {
  repo = new Repository<ThingId, Thing>(
    {
      tableName: 'table1',
      typeName: 'Thing',
      primaryIndex: {
        tag: 'primary',
        partitionKey: 'pk1',
        sortKey: 'sk1',
        fields: ['id'],
      },
      secondaryIndexes: [],
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

test('batch write should work with one table', async () => {
  const ids = [...Array(35).keys()].map(id => String(id));
  
  await expect(
    batchWrite(
      repo.ddb,
      ids.map(id => repo.batch.put({id, name: 'meow'}))
    )
  ).resolves.toHaveLength(35)
  

  await Promise.all(ids.map(async (id) => {
    return expect(repo.get({id})).resolves.toMatchObject({
      id,
      name: 'meow'
    })
  }))

  await expect(batchGet(repo.ddb, ids.map(id => repo.batch.get({id})))).resolves.toMatchObject(
    ids.map(id => ({id, name: 'meow'}))
  )
})