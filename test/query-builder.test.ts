import { QueryBuilder } from './../src/query-builder';

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
      ':attr0': 'USA',
      ':attr1': 'Jef',
    },
    IndexName: 'MyIndex',
    KeyConditionExpression: '#attr0 = :attr0 and begins_with(#attr1, :attr1)',
    ScanIndexForeward: false,
    Select: 'ALL_ATTRIBUTES',
    TableName: 'MyTable',
  });
});
