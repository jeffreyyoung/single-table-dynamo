import { Repository } from './../src/repository';
import sinon from 'sinon';
import Sinon from 'sinon';
import { DocumentClient } from 'aws-sdk/clients/dynamodb';

type UserId = {
  id: string;
};

type User = UserId & {
  followers: string[];
  country: string;
  city: string;
  state: string;
};
const globals: {
  repo: Repository<UserId, User>;
  stub: Sinon.SinonStubbedInstance<DocumentClient>;
} = {} as any;

beforeEach(() => {
  globals['stub'] = sinon.stub(new DocumentClient());
  globals['repo'] = new Repository<UserId, User>(
    {
      tableName: 'meow',
      typeName: 'User',
      indexes: [
        {
          tag: 'primary',
          partitionKey: 'yay',
          sortKey: 'meow',
          fields: ['id'],
        },
      ],
    },
    globals['stub'] as any
  );
});

test('updateUnsafe should call document client with correct params', () => {
  globals['stub'].update.returns({promise: () => ({})} as any);
  globals['repo'].updateUnsafe(
    { id: 'meow' },
    {
      city: 'jimmy',
      state: 'hendricks',
    }
  );

  expect(globals['stub'].update.called).toBe(true);
  expect(globals.stub.update.getCall(0)?.args).toMatchInlineSnapshot(`
    Array [
      Object {
        "ExpressionAttributeNames": Object {
          "#attribute_0": "city",
          "#attribute_1": "state",
        },
        "ExpressionAttributeValues": Object {
          ":attribute_0": "jimmy",
          ":attribute_1": "hendricks",
        },
        "Key": Object {
          "meow": "User",
          "yay": "User#meow",
        },
        "ReturnValues": "ALL_NEW",
        "TableName": "meow",
        "UpdateExpression": "set #attribute_0 = :attribute_0, #attribute_1 = :attribute_1",
      },
    ]
  `);
});
