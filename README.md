# Single Table Dynamodb

There are a few other dynamodb clients that help simplify using dynamodb in a node environment, but most encourage the use of multiple tables.  This client is built with the idea of storing all data in a single table. https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-general-nosql-design.html

## Getting started

```
yarn add single-table-dynamo
```

## Example

```typescript
import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import { Repository } from '../src';

// define properties of our dynamodb table
const TableConfig = {
  tableName: 'GenericTable',
  primaryIndex: {
    partitionKey: 'pk',
    sortKey: 'sk',
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

// add types for the entity to be stored in dynamodb
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

// create a repo
const repo = new Repository<UserId,User>({
  typeName: 'User',
  tableName: 'GenericTable',
  indexes: [{
    tag: 'primaryIndex',
    fields: ['id'],
    ...TableConfig.primaryIndex,
  }, { // single-table-dynamo will handle generating composite indexes
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
```
