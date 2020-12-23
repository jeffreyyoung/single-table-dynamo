import { Mapper } from './../src/mapper';
import { tableConfig } from './utils/table_config';
type UserId = {
  state: string;
  country: string;
  createdAt: string;
};
type User = {
  id: string;
  state: string;
  country: string;
  createdAt: string;
  updatedAt: string;
  count: number;
  banned?: string;
};

const mapper = new Mapper<UserId, User>({
  typeName: 'User',
  primaryIndex: {
    ...tableConfig.primaryIndex,
    tag: 'countryByStateByCreatedAt',
    fields: ['country', 'state', 'createdAt'],
  },
  secondaryIndexes: [
    {
      ...tableConfig.secondaryIndexes[0],
      tag: 'stateByCountryByYeehaw',
      fields: [
        'state',
        'country',
        { toString: () => 'yeehaw', fields: ['count'] },
      ],
    },
    {
      ...tableConfig.secondaryIndexes[1],
      sparse: true,
      shouldWriteIndex: src => src.state === 'UT',
      tag: 'stateCreatedAt',
      fields: [
        'state',
        'createdAt',
        { toString: () => 'yeehaw', fields: ['count'] },
      ],
    },
    {
      ...tableConfig.secondaryIndexes[2],
      sparse: true,
      fields: ['banned', 'id'],
    },
    {
      ...tableConfig.secondaryIndexes[3],
      indexName: 'countryByUpdatedAt',
      tag: 'meowowow',
      partitionKey: 'state',
      sortKey: 'country',
    },
  ],
});

test('should decorate all fields', () => {
  expect(
    mapper.decorateWithCompositeFields({
      id: 'yay',
      count: 23,
      banned: 'yes',
      country: 'usa',
      state: 'UT',
      createdAt: 'today',
      updatedAt: 'tomorrow',
    })
  ).toMatchInlineSnapshot(`
    Object {
      "banned": "yes",
      "count": 23,
      "country": "usa",
      "createdAt": "today",
      "id": "yay",
      "pk0": "User#usa",
      "pk1": "User#UT",
      "pk2": "User#UT",
      "pk3": "User#yes",
      "sk0": "User#UT#today",
      "sk1": "User#usa#yeehaw",
      "sk2": "User#today#yeehaw",
      "sk3": "User#yay",
      "state": "UT",
      "updatedAt": "tomorrow",
    }
  `);
});

test('should decorate all fields except pk3,sk3', () => {
  expect(
    mapper.decorateWithCompositeFields({
      id: 'yay',
      count: 23,
      country: 'usa',
      state: 'UT',
      createdAt: 'today',
      updatedAt: 'tomorrow',
    })
  ).toMatchInlineSnapshot(`
    Object {
      "count": 23,
      "country": "usa",
      "createdAt": "today",
      "id": "yay",
      "pk0": "User#usa",
      "pk1": "User#UT",
      "pk2": "User#UT",
      "sk0": "User#UT#today",
      "sk1": "User#usa#yeehaw",
      "sk2": "User#today#yeehaw",
      "state": "UT",
      "updatedAt": "tomorrow",
    }
  `);
});

test('should decorate all fields except pk2, sk2 ', () => {
  expect(
    mapper.decorateWithCompositeFields({
      id: 'yay',
      count: 23,
      country: 'usa',
      state: 'WA',
      createdAt: 'today',
      updatedAt: 'tomorrow',
      banned: 'yes',
    })
  ).toMatchInlineSnapshot(`
    Object {
      "banned": "yes",
      "count": 23,
      "country": "usa",
      "createdAt": "today",
      "id": "yay",
      "pk0": "User#usa",
      "pk1": "User#WA",
      "pk3": "User#yes",
      "sk0": "User#WA#today",
      "sk1": "User#usa#yeehaw",
      "sk3": "User#yay",
      "state": "WA",
      "updatedAt": "tomorrow",
    }
  `);
});
