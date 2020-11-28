import { IndexQueryBuilder } from '../src/index-query-builder';
import { Mapper } from './../src/mapper';

type User = {
  id: string;
  state: string;
  country: string;
  createdAt: string;
  updatedAt: string;
  count: number;
};

// const indexes = [
//   {
//     partitionKey: 'pk1',
//     sortKey: 'sk1',
//   },
//   {
//     indexName: 'third',
//     partitionKey: 'pk2',
//     sortKey: 'sk2',
//   },
// ];

const mapper = new Mapper<User>({
  typeName: 'User',
  indexes: [
    {
      partitionKey: 'pk1',
      sortKey: 'sk1',
      tag: 'countryByStateByCreatedAt',
      fields: ['country', 'state', 'createdAt'],
    },
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

const getBuilder = (which: number) =>
  new IndexQueryBuilder<User>('yeehaw', mapper.args.indexes[which], mapper);

test('should build query with no sortkey', () => {
  expect(
    getBuilder(0)
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
    KeyConditionExpression: "#attr0 EQ :attr0 and #attr1 BEGINS_WITH :attr1",
    ScanIndexForeward: false,
    Select: 'ALL_ATTRIBUTES',
    TableName: 'yeehaw',
  });
});

test('should build query with extra fields', () => {
  expect(
    getBuilder(0)
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
    "KeyConditionExpression": "#attr0 EQ :attr0 and #attr1 BEGINS_WITH :attr1",
    ScanIndexForeward: false,
    Select: 'ALL_ATTRIBUTES',
    TableName: 'yeehaw',
  });
});

test('should build query with sortkey', () => {
  expect(
    getBuilder(0)
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
    KeyConditionExpression: '#attr0 EQ :attr0 and #attr1 BEGINS_WITH :attr1',
    ScanIndexForeward: false,
    Select: 'ALL_ATTRIBUTES',
    Limit: 25,
    TableName: 'yeehaw',
  });
});

test('should throw with no partition key', () => {
  expect(() =>
    getBuilder(0)
      .where({
        state: 'UT',
      })
      .limit(25)
      .build()
  ).toThrowErrorMatchingSnapshot();
});

test('should build non primary index', () => {
  expect(
    getBuilder(1)
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
    "KeyConditionExpression": "#attr0 EQ :attr0 and #attr1 BEGINS_WITH :attr1",
    IndexName: "third",
    Limit: 25,
    ScanIndexForeward: false,
    Select: 'ALL_ATTRIBUTES',
    TableName: 'yeehaw',
  });
});
