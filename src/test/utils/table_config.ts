export const range =(count: number) => [...Array(count).keys()];

export const tableConfig = {
  tableName: 'table1',
  primaryIndex: {
    pk: 'pk1',
    sk: 'sk1'
  },
  secondaryIndexes: range(24).map(i => ({
    indexName: 'gsi'+(i+1),
    pk: 'pk'+(i+1),
    sk: 'sk'+(i+1)
  }))
}