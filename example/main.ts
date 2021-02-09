import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import { object, string } from 'superstruct';
import { Repository } from '../src';

const TableConfig = {
  tableName: 'GenericTable',
  primaryIndex: {
    pk: 'pk1',
    sk: 'sk0'
  },
  secondaryIndexes: [{
    indexName: 'gsi1',
    pk: 'pk1',
    sk: 'sk1',
  }, {
    indexName: 'gsi2',
    pk: 'pk2',
    sk: 'sk2',
  }]
}

const repo = new Repository({
  //define an object schema
  schema: object({
    id: string(),
    country: string(),
    state: string(),
    city: string()
  }),
  objectName: 'User',
  tableName: 'GenericTable',
  
  //define our primary index
  primaryIndex: {
    fields: ['id'],
    ...TableConfig.primaryIndex,
  },

  //define our secondary indexes
  secondaryIndexes: {
    byCountryByStateByCity: {
      fields: ['country', 'state', 'city'],
      ...TableConfig.secondaryIndexes[0],
    }
  }
}, new DocumentClient());

  
let user1 = await repo.put({
    id: '1',
    city: 'Orlando',
    state: 'Washington',
    country: 'Canada',
})

user1 = await repo.get({id: '1'});

await repo.delete({id: '1'});

const result = await repo
  .query('byStateByCreatedDate')
  .where({state: 'WA'})
  .limit(10)
  .sort('asc')
  .execute();