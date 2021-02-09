import { QueryBuilder } from '../query-builder';

test('should format query request properly', () => {
  const builder = new QueryBuilder();

  expect(
    builder
      .table('MyTable')
      .index('MyIndex')
      .where('Country', '=', 'USA')
      .where('Name', 'BEGINS_WITH', 'Jef')
      .limit(27)
      .cursor({ Country: 'Belgium', Name: 'Jim' })
      .build()
  ).toEqual({
    ExclusiveStartKey: {
      Country: 'Belgium',
      Name: 'Jim',
    },
    Limit: 27,
    ExpressionAttributeNames: {
      '#attr0': 'Country',
      '#attr1': 'Name',
    },
    ExpressionAttributeValues: {
      ':value0': 'USA',
      ':value1': 'Jef',
    },
    IndexName: 'MyIndex',
    KeyConditionExpression: '#attr0 = :value0 and begins_with(#attr1, :value1)',
    ScanIndexForeward: false,
    Select: 'ALL_ATTRIBUTES',
    TableName: 'MyTable',
  });
});
