export const range = (count: number) => [...Array(count).keys()];

export const tableConfig = {
  tableName: "table1",
  primaryIndex: {
    pk: "pk1",
    sk: "sk1",
  },
  secondaryIndexes: range(24).map((i) => ({
    indexName: "gsi" + (i + 1),
    pk: "pk" + (i + 1),
    sk: "sk" + (i + 1),
  })),
};

export const TABLE_DEF = {
  tableName: "THINGS_TABLE",
  primaryIndex: {
    pk: "pk0",
    sk: "sk0",
  },
  globalSecondaryIndexes: [
    {
      indexName: "gsi1",
      pk: "pk1",
      sk: "sk1",
    },
    {
      indexName: "gsi2",
      pk: "pk2",
      sk: "sk2",
    },
    {
      indexName: "gsi3",
      pk: "pk3",
      sk: "sk3",
    },
    {
      indexName: "gsi4",
      pk: "pk4",
      sk: "sk4",
    },
    {
      indexName: "gsi5",
      pk: "pk5",
      sk: "sk5",
    },
    {
      indexName: "gsi6",
      pk: "pk6",
      sk: "sk6",
    },
    {
      indexName: "gsi7",
      pk: "pk7",
      sk: "sk7",
    },
  ],
};
