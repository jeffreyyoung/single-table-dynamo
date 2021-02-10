
//@ts-ignore-all
import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import { object, string } from 'superstruct';
import { Repository, InferObjectType, InferIdType } from '../src';

// create a repository that can be used for CRUD/Query operations
const repo = new Repository({
  
  // create a schema for the objects to store in dynamodb
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
  typeName: 'User',
}, new DocumentClient())

// get an object
const user = await repo.get({id: 'user1'});

// delete
await repo.delete({id: 'user1'});

// create
const newUser = await repo.put({id: "user1", city: "otis", state: "kansas", country: "usa"})

// query
const results = await repo.query('fasdlkf')
  .where({country: 'usa'})
  .exec();

// extract entity type from repo
type O = InferObjectType<typeof repo>; // {id: string, country: string, city: string, state: string }

// extract id type from repo
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
