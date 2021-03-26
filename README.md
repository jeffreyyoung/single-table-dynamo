# Single Table Dynamodb

There are a few other dynamodb clients that help simplify using dynamodb in a node environment, but most encourage the use of multiple tables.  This client is built with the idea of storing all data in a single table. https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-general-nosql-design.html

## Getting started

```
yarn add single-table-dynamo
```

## Example

```typescript
import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import { object, string } from 'superstruct';
import { Repository } from 'single-table-dynamo';

// create a repository that can be used for CRUD/Query operations
const repo = new Repository({

  // add a name for the entity to be stored in dynamodb
  typeName: 'User',

  // create a schema for the entity
  schema: object({
    id: string(),
    country: string(),
    state: string(),
    city: string()
  }),

  // define the id fields for this object
  primaryIndex: {
    fields: ['id'],
    ...TableConfig.primaryIndex
  },

  // define secondaryIndexes that can be used for additional queries
  secondaryIndexes: {
    byCountryByStateByCity: {
      fields: ['country', 'state', 'city'],
      ...TableConfig.secondaryIndexes[0]
    }
  },

  tableName: TableConfig.tableName,
}, new DocumentClient())


// get an object
const user = await repo.get({id: 'user1'});

// delete
await repo.delete({id: 'user1'});

// create
const newUser = await repo.put({id: "user1", city: "otis", state: "kansas", country: "usa"})

// query
const results = await repo.query('byCountryByStateByCity')
  .where({country: 'usa'})
  .exec();

// infer object type from repo
type O = InferObjectType<typeof repo>; // {id: string, country: string, city: string, state: string }

// infer id type from repo
type Id = InferIdType<typeof repo>; // {id: string}

var TableConfig = {
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

```
