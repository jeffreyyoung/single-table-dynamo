import { number, object, string } from 'superstruct';
import { IndexQueryBuilder } from '../index-query-builder';
import { IndexBase, Mapper } from '../mapper';

const mapper = new Mapper({
  objectName: 'User',
  tableName: 'table1',
  schema: object({
    state: string(),
    country: string(),
    createdAt: string(),
    id: string(),
    updatedAt: string(),
    count: number(),
  }),
  primaryIndex: {
    pk: 'pk1',
    sk: 'sk1',
    tag: 'countryByStateByCreatedAt',
    fields: ['country', 'state', 'createdAt'],
  },
  secondaryIndexes: {
    stateByCountryByYeehaw: {
      indexName: 'third',
      pk: 'pk2',
      sk: 'sk2',
      stringifyField: {
        count: (name, src) => 'yeehaw',
      },
      fields: ['state', 'country', 'count'],
    },
    // {
    //   indexName: 'countryByUpdatedAt',
    //   tag: 'meowowow',
    //   partitionKey: 'state',
    //   sortKey: 'country',
    // },
  },
});

const getBuilder = <T>(index: IndexBase<T>) =>
  new IndexQueryBuilder<any>({ tableName: 'yeehaw', index, mapper } as any);

test('should build query with no sortkey', () => {
  expect(
    getBuilder(mapper.args.primaryIndex as any)
      .where({
        country: 'USA',
      })
      .limit(25)
      .build()
  ).toEqual({
    ExpressionAttributeNames: {
      '#attr0': 'pk1',
      '#attr1': 'sk1',
    },
    ExpressionAttributeValues: {
      ':value0': 'User#USA',
      ':value1': 'User',
    },
    Limit: 25,
    KeyConditionExpression: '#attr0 = :value0 and begins_with(#attr1, :value1)',
    ScanIndexForeward: false,
    Select: 'ALL_ATTRIBUTES',
    TableName: 'yeehaw',
  });
});

test('should build query with extra fields', () => {
  expect(
    getBuilder(mapper.args.primaryIndex as any)
      .where({
        country: 'USA',
        createdAt: '2010-10-21',
      })
      .limit(25)
      .build()
  ).toEqual({
    ExpressionAttributeNames: {
      '#attr0': 'pk1',
      '#attr1': 'sk1',
    },
    ExpressionAttributeValues: {
      ':value0': 'User#USA',
      ':value1': 'User',
    },
    Limit: 25,
    KeyConditionExpression: '#attr0 = :value0 and begins_with(#attr1, :value1)',
    ScanIndexForeward: false,
    Select: 'ALL_ATTRIBUTES',
    TableName: 'yeehaw',
  });
});

test('should build query with sortkey', () => {
  expect(
    getBuilder(mapper.args.primaryIndex)
      .where({
        country: 'USA',
        state: 'UT',
      })
      .limit(25)
      .build()
  ).toEqual({
    ExpressionAttributeNames: {
      '#attr0': 'pk1',
      '#attr1': 'sk1',
    },
    ExpressionAttributeValues: {
      ':value0': 'User#USA',
      ':value1': 'User#UT',
    },
    KeyConditionExpression: '#attr0 = :value0 and begins_with(#attr1, :value1)',
    ScanIndexForeward: false,
    Select: 'ALL_ATTRIBUTES',
    Limit: 25,
    TableName: 'yeehaw',
  });
});

test('should throw with no partition key', () => {
  expect(() =>
    getBuilder(mapper.args.primaryIndex)
      .where({
        state: 'UT',
      })
      .limit(25)
      .build()
  ).toThrowErrorMatchingInlineSnapshot(
    `"To query index: {\\"pk\\":\\"pk1\\",\\"sk\\":\\"sk1\\",\\"tag\\":\\"countryByStateByCreatedAt\\",\\"fields\\":[\\"country\\",\\"state\\",\\"createdAt\\"]}, field: country is required, recieved {\\"state\\":\\"UT\\"}, debugInfo: {}"`
  );
});

test('should build non primary index', () => {
  expect(
    getBuilder(mapper.args.secondaryIndexes!['stateByCountryByYeehaw'])
      .where({
        state: 'WA',
      })
      .build()
  ).toEqual({
    ExpressionAttributeNames: {
      '#attr0': 'pk2',
      '#attr1': 'sk2',
    },
    ExpressionAttributeValues: {
      ':value0': 'User#WA',
      ':value1': 'User',
    },
    KeyConditionExpression: '#attr0 = :value0 and begins_with(#attr1, :value1)',
    IndexName: 'third',
    Limit: 25,
    ScanIndexForeward: false,
    Select: 'ALL_ATTRIBUTES',
    TableName: 'yeehaw',
  });
});
