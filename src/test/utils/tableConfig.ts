export const range = (count: number) => [...Array(count).keys()];

export const tableConfig = {
  tableName: "THINGS_TABLE",
  primaryIndex: {
    pk: "pk0",
    sk: "sk0",
  },
  secondaryIndexes: range(24).map((i) => ({
    indexName: "gsi" + (i + 1),
    pk: "pk" + (i + 1),
    sk: "sk" + (i + 1),
  })),
};
