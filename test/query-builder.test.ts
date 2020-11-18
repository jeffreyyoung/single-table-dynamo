import { QueryBuilder } from './../src/v2/query-builder';

test('should format query request properly', () => {
  const builder = new QueryBuilder();

  expect(
    builder
      .table('MyTable')
      .index('MyIndex')
      .where('Country', 'EQ', 'USA')
      .where('Name', 'BEGINS_WITH', 'Jef')
      .limit(27)
      .cursor({ Country: 'Belgium', Name: 'Jim' })
      .build()
  ).toEqual({
    ExclusiveStartKey: {
      Country: 'Belgium',
      Name: 'Jim',
    },
    ExpressionAttributeNames: {
      '#attr0': 'Country',
      '#attr1': 'Name',
    },
    ExpressionAttributeValues: {
      ':attr0': 'USA',
      ':attr1': 'Jef',
    },
    IndexName: 'MyIndex',
    KeyConditionExpression: '#attr0 EQ :attr0 and #attr1 BEGINS_WITH :attr1',
    ScanIndexForeward: false,
    Select: 'ALL_ATTRIBUTES',
    TableName: 'MyTable',
  });
});
