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
let thingRepo: Repository<ThingId, Thing>;

type PersonId = {
  personId: string
}
type Person = PersonId & {
  name: string
}
let personRepo: Repository<PersonId, Person>;
beforeEach(() => {
  const ddb = new DocumentClient({
    ...(process.env.MOCK_DYNAMODB_ENDPOINT && {
      endpoint: process.env.MOCK_DYNAMODB_ENDPOINT,
      sslEnabled: false,
      region: 'local',
    }),
  });
  personRepo = new Repository<PersonId, Person>(
    {
      tableName: 'table1',
      typeName: 'Person',
      primaryIndex: {
        tag: 'primary',
        partitionKey: 'pk1',
        sortKey: 'sk1',
        fields: ['personId'],
      },
      secondaryIndexes: [],
    },
    ddb
  );

  thingRepo = new Repository<ThingId, Thing>(
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
    ddb
  );
});

test('types should infer correctly', async () => {
  await expect(
    batchGet(personRepo.ddb, [
      personRepo.batch.get({personId: 'meow'}),
      thingRepo.batch.get({id: 'nooo'})
    ])
  ).resolves.toEqual([undefined, undefined]);
});

test('batch write should work with one table', async () => {
  const ids = [...Array(35).keys()].map(id => String(id));
  
  await expect(
    batchWrite(
      thingRepo.ddb,
      [
        ...ids.map(id => thingRepo.batch.put({id, name: 'meow'})),
        ...ids.map(id => personRepo.batch.put({personId: id, name: 'yo'}))
      ]
    )
  ).resolves.toHaveLength(70)

  await expect(batchGet(thingRepo.ddb, [
    ...ids.map(id => thingRepo.batch.get({id})),
    ...ids.map(id => personRepo.batch.get({personId: id}))
  ])).resolves.toMatchObject([
    ...ids.map(id => ({id, name: 'meow'})),
    ...ids.map(id => ({personId: id, name: 'yo'}))
  ])
})