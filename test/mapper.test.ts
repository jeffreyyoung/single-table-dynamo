import { Mapper } from './../src/mapper';
type UserId = {
  state: string;
  country: string;
  createdAt: string;
}
type User = {
  id: string;
  state: string;
  country: string;
  createdAt: string;
  updatedAt: string;
  count: number;
};

const primaryIndex = {
    partitionKey: 'pk1',
    sortKey: 'sk1',
  }

const gsi1 =  {
    indexName: 'third',
    partitionKey: 'pk2',
    sortKey: 'sk2',
  };

const mapper = new Mapper<UserId, User>({
  typeName: 'User',
  primaryIndex: {
    ...primaryIndex,
    tag: 'countryByStateByCreatedAt',
    fields: ['country', 'state', 'createdAt'],
  },
  secondaryIndexes: [
    {
      ...gsi1,
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

test('should format object for dynamodb properly', () => {
  expect(
    mapper.decorateWithCompositeFields({
      updatedAt: 'today',
      createdAt: 'yesterday',
      country: 'USA',
      id: '1234',
      state: 'WA',
      count: 25,
    })
  ).toEqual({
    updatedAt: 'today',
    createdAt: 'yesterday',
    country: 'USA',
    id: '1234',
    state: 'WA',
    count: 25,

    pk1: 'User#USA',
    pk2: 'User#WA',
    sk1: 'User#WA#yesterday',
    sk2: 'User#USA#yeehaw',
  });

  expect(
    mapper.decorateWithCompositeFields({
      updatedAt: 'today',
      createdAt: 'tomorrow',
      country: 'USA',
      id: '1235',
      state: 'UT',
      count: 33,
    })
  ).toEqual({
    updatedAt: 'today',
    createdAt: 'tomorrow',
    country: 'USA',
    id: '1235',
    state: 'UT',
    count: 33,

    pk1: 'User#USA',
    sk1: 'User#UT#tomorrow',

    pk2: 'User#UT',
    sk2: 'User#USA#yeehaw',
  });
});

test('should format partial index properly', () => {
  expect(
    mapper.computeIndexFields(
      { country: 'USA', state: 'UT' },
      mapper.args.primaryIndex
    )
  ).toEqual({
    pk1: 'User#USA',
    sk1: 'User#UT',
  });

  expect(
    mapper.computeIndexFields({ country: 'USA' }, mapper.args.primaryIndex)
  ).toEqual({
    pk1: 'User#USA',
    sk1: 'User'
  });

});

test('should throw when no partition key is provided', () => {
  expect(
    () => mapper.computeIndexFields({ }, mapper.args.primaryIndex)
  ).toThrow();
})
