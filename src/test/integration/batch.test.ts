import { Repository } from '../../repository';
import { batchWrite } from '../../batch-write';
import { batchGet } from '../../batch-get';
import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import { object, string } from 'superstruct';

const ddb = new DocumentClient({
  ...(process.env.MOCK_DYNAMODB_ENDPOINT && {
    endpoint: process.env.MOCK_DYNAMODB_ENDPOINT,
    sslEnabled: false,
    region: 'local',
  }),
});
const personRepo = new Repository(
  {
    schema: object({
      personId: string(),
      name: string()
    }),
    tableName: 'table1',
    entityType: 'Person',
    primaryIndex: {
      tag: 'primary',
      pk: 'pk1',
      sk: 'sk1',
      fields: ['personId'],
    },
  },
  ddb
);

const thingRepo = new Repository(
  {
    schema: object({
      id: string(),
      name: string()
    }),
    tableName: 'table1',
    entityType: 'Thing',
    primaryIndex: {
      tag: 'primary',
      pk: 'pk1',
      sk: 'sk1',
      fields: ['id'],
    },
  },
  ddb
);


test('types should infer correctly', async () => {
  await expect(
    batchGet(ddb, [
      personRepo.batch.get({personId: 'meow'}),
      thingRepo.batch.get({id: 'nooo'})
    ])
  ).resolves.toEqual([undefined, undefined]);
});

test('batch write should work with one table', async () => {
  const ids = [...Array(35).keys()].map(id => String(id));
  
  await expect(
    batchWrite(
      ddb,
      [
        ...ids.map(id => thingRepo.batch.put({id, name: 'meow'})),
        ...ids.map(id => personRepo.batch.put({personId: id, name: 'yo'}))
      ]
    )
  ).resolves.toHaveLength(70)

  await expect(batchGet(ddb, [
    ...ids.map(id => thingRepo.batch.get({id})),
    ...ids.map(id => personRepo.batch.get({personId: id}))
  ])).resolves.toMatchObject([
    ...ids.map(id => ({id, name: 'meow'})),
    ...ids.map(id => ({personId: id, name: 'yo'}))
  ])
})