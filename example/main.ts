import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import { Repository } from '../src';

const TableConfig = {
  tableName: 'GenericTable',
  primaryIndex: {
    partitionKey: 'pk',
  },
  secondaryIndexes: [{
    indexName: 'gsi1',
    partitionKey: 'pk1',
    sortKey: 'sk1',
  }, {
    indexName: 'gsi2',
    partitionKey: 'pk2',
    sortKey: 'sk2',
  }]
}
type UserId = {
  id: string;
}
type User = UserId & {
  name: string
  createdDate: string
  state: string
  country: string
  city: string
}

const docClient = new DocumentClient();

const repo = new Repository<UserId,User>({
  typeName: 'User',
  tableName: 'GenericTable',
  indexes: [{
    tag: 'primaryIndex',
    fields: ['id'],
    ...TableConfig.primaryIndex,
  }, {
    tag: 'byCountryByStateByCity',
    fields: ['country', 'state', 'city'],
    ...TableConfig.secondaryIndexes[0],
  }, {
    tag: 'byStateByCreatedDate',
    fields: ['state', 'createdDate'],
    ...TableConfig.secondaryIndexes[1],
  }]
}, docClient);

async function main() {
  
  let user1 = await repo.put({
    id: '1',
    city: 'Orlando',
    state: 'Washington',
    country: 'Canada',
    createdDate: '2011-10-31',
    name: 'Jonny'
  })

  user1 = await repo.get({id: '1'});

  await repo.delete({id: '1'});

  const result = await repo
    .query('byStateByCreatedDate')
    .where({state: 'WA'})
    .limit(10)
    .sort('asc')
    .execute();
  console.log(result.Items);
}