export const range =(count: number) => [...Array(count).keys()];

export const tableConfig = {
  primaryIndex: {
    partitionKey: 'pk0',
    sortKey: 'sk0'
  },
  secondaryIndexes: range(24).map(i => ({
    indexName: 'gsi'+(i+1),
    partitionKey: 'pk'+(i+1),
    sortKey: 'sk'+(i+1)
  }))
}