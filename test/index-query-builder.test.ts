import { IndexQueryBuilder } from '../src/index-query-builder';
import { Mapper, Index } from './../src/mapper';
type UserId = {
  state: string;
  country: string;
  createdAt: string;
}
type User = UserId & {
  id: string;
  state: string;
  country: string;
  createdAt: string;
  updatedAt: string;
  count: number;
};

const mapper = new Mapper<UserId, User>({
  typeName: 'User',
  primaryIndex: {
    partitionKey: 'pk1',
    sortKey: 'sk1',
    tag: 'countryByStateByCreatedAt',
    fields: ['country', 'state', 'createdAt'],
  },
  secondaryIndexes: [
    {
      indexName: 'third',
      partitionKey: 'pk2',
      sortKey: 'sk2',
      tag: 'stateByCountryByYeehaw',
      fields: [
        'state',
        'country',
        { toString: () => 'yeehaw', fields: ['count'] },
      ],
    },
    {
      indexName: 'countryByUpdatedAt',
      tag: 'meowowow',
      partitionKey: 'state',
      sortKey: 'country',
    },
  ],
});

const getBuilder = (index: Index) =>
  new IndexQueryBuilder<UserId, User>('yeehaw', index, mapper);

test('should build query with no sortkey', () => {
  expect(
    getBuilder(mapper.args.primaryIndex)
      .where({
        country: 'USA',
      })
      .limit(25)
      .build()
  ).toEqual({
    ExpressionAttributeNames: {
      '#attr0': 'pk1',
      "#attr1": "sk1",
    },
    ExpressionAttributeValues: {
      ':attr0': 'User#USA',
      ":attr1": "User",
    },
    Limit: 25,
    KeyConditionExpression: "#attr0 = :attr0 and begins_with(#attr1, :attr1)",
    ScanIndexForeward: false,
    Select: 'ALL_ATTRIBUTES',
    TableName: 'yeehaw',
  });
});

test('should build query with extra fields', () => {
  expect(
    getBuilder(mapper.args.primaryIndex)
      .where({
        country: 'USA',
        createdAt: '2010-10-21',
      })
      .limit(25)
      .build()
  ).toEqual({
    ExpressionAttributeNames: {
      '#attr0': 'pk1',
      "#attr1": "sk1",
    },
    ExpressionAttributeValues: {
      ':attr0': 'User#USA',
      ":attr1": "User",
    },
    Limit: 25,
    "KeyConditionExpression": "#attr0 = :attr0 and begins_with(#attr1, :attr1)",
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
      ':attr0': 'User#USA',
      ':attr1': 'User#UT',
    },
    KeyConditionExpression: '#attr0 = :attr0 and begins_with(#attr1, :attr1)',
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
  ).toThrowErrorMatchingSnapshot();
});

test('should build non primary index', () => {
  expect(
    getBuilder(mapper.args.secondaryIndexes![0]!)
      .where({
        state: 'WA',
      })
      .build()
  ).toEqual({
    ExpressionAttributeNames: {
      '#attr0': 'pk2',
      '#attr1': 'sk2'
    },
    ExpressionAttributeValues: {
      ':attr0': 'User#WA',
      ':attr1': 'User'
    },
    "KeyConditionExpression": "#attr0 = :attr0 and begins_with(#attr1, :attr1)",
    IndexName: "third",
    Limit: 25,
    ScanIndexForeward: false,
    Select: 'ALL_ATTRIBUTES',
    TableName: 'yeehaw',
  });
});
