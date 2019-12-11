import { getLSIName, getLSISortKeyAttribute } from './utils';
import { AWS } from './AWS';
import {
  CreateTableInput,
  LocalSecondaryIndex,
} from 'aws-sdk/clients/dynamodb';
import { Index } from './config';

export type CreateTableArgs = {
  tableName?: string;
};

let defaultTableName = 'SingleTable';

export function getDefaultTableName() {
  return defaultTableName;
}

export function setDefaultTableName(newName: string) {
  defaultTableName = newName;
}

function range(start: number, end: number) {
  let nums = [];
  for (let i = start; i <= end; i++) {
    nums.push(i);
  }
  return nums;
}

type LSI = {
  indexName: string;
  sortKeyAttributeName: string;
};

export function getGSIDef(index: Index<any, any>) {
  if (index.type === 'globalSecondaryIndex') {
    return {
      IndexName: index.indexName,
      KeySchema: [
        { AttributeName: index.hashKeyAttribute, KeyType: 'HASH' },
        { AttributeName: index.sortKeyAttribute, KeyType: 'RANGE' },
      ],
      Projection: {
        ProjectionType: 'ALL',
      },
    };
  }

  throw {
    message: `given index of type ${index.type}, expecting globalSecondaryIndex`,
  };
}

// type GSI = {
//     indexName: string
//     sortKeyAttributeName: string
//     hashKeyAttributeName: string
// }
/**
 *
 * Creates a table with 5 local secondary indexes
 *
 */
export function createTable(args: {
  tableName: string;
  indexes?: Index<any, any>[];
}) {
  var client = new AWS.DynamoDB();

  let localSecondaryIndexes = range(0, 4).map<LSI>(i => ({
    indexName: getLSIName(i),
    sortKeyAttributeName: getLSISortKeyAttribute(i),
  }));

  let globalSecondaryIndexes = (args.indexes || []).map(i => getGSIDef(i));

  let createTableInput: CreateTableInput = {
    TableName: args.tableName || getDefaultTableName(),
    KeySchema: [
      { AttributeName: '__hashKey', KeyType: 'HASH' },
      { AttributeName: '__sortKey', KeyType: 'RANGE' },
    ],
    AttributeDefinitions: [
      { AttributeName: '__hashKey', AttributeType: 'S' },
      { AttributeName: '__sortKey', AttributeType: 'S' },
      ...localSecondaryIndexes.map(i => ({
        AttributeName: i.sortKeyAttributeName,
        AttributeType: 'S' }
      )),
      ...(args.indexes as Index<any, any>[]).map(i => ({
        AttributeName: i.sortKeyAttribute,
        AttributeType: 'S',
      })),
      ...(args.indexes as Index<any, any>[]).map(i => ({
        AttributeName: i.hashKeyAttribute,
        AttributeType: 'S',
      })),
    ],
    LocalSecondaryIndexes: [
      ...localSecondaryIndexes.map<LocalSecondaryIndex>(i => ({
        IndexName: i.indexName,
        KeySchema: [
          { AttributeName: '__hashKey', KeyType: 'HASH' },
          { AttributeName: i.sortKeyAttributeName, KeyType: 'RANGE' },
        ],
        Projection: {
          ProjectionType: 'ALL',
        },
      })),
    ],
    GlobalSecondaryIndexes: globalSecondaryIndexes,
    BillingMode: 'PAY_PER_REQUEST',
  };

  if (createTableInput.LocalSecondaryIndexes!.length === 0) {
    delete createTableInput.LocalSecondaryIndexes;
  }
  if (createTableInput.GlobalSecondaryIndexes!.length ===0) {
    delete createTableInput.GlobalSecondaryIndexes;
  }
  return client.createTable(createTableInput).promise()
    .then(() => client.waitFor('tableExists', {TableName: createTableInput.TableName}))
    .then(() => console.log(`${createTableInput.TableName} has been created`));
}
