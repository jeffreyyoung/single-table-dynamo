import { Repository } from '../repository';
import sinon from 'sinon';
import Sinon from 'sinon';
import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import { array, Infer, object, string } from 'superstruct';

const schema = object({
  id: string(),
  followers: array(string()),
  country: string(),
  city: string(),
  state: string()
})

const globals: {
  repo: Repository<Infer<typeof schema>, 'id'>;
  stub: Sinon.SinonStubbedInstance<DocumentClient>;
} = {} as any;

beforeEach(() => {
  globals['stub'] = sinon.stub(new DocumentClient());
  globals['repo'] = new Repository(
    {
      tableName: 'meow',
      objectName: 'User',
      schema,
      primaryIndex: {
        tag: 'primary',
        pk: 'yay',
        sk: 'meow',
        fields: ['id'],
      },
    },
    globals['stub'] as any
  );
});

test('updateUnsafe should call document client with correct params', () => {
  globals['stub'].update.returns({ promise: () => ({}) } as any);
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
        "ConditionExpression": "attribute_exists(#attr2) and attribute_exists(#attr3)",
        "ExpressionAttributeNames": Object {
          "#attr0": "city",
          "#attr1": "state",
          "#attr2": "yay",
          "#attr3": "meow",
        },
        "ExpressionAttributeValues": Object {
          ":value0": "jimmy",
          ":value1": "hendricks",
        },
        "Key": Object {
          "meow": "User",
          "yay": "User#meow",
        },
        "ReturnValues": "ALL_NEW",
        "TableName": "meow",
        "UpdateExpression": "set #attr0 = :value0, #attr1 = :value1",
      },
    ]
  `);
});
