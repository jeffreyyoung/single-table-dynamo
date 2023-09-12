export type TableConfig = {
  tableName: string;
  primaryIndex: {
    pk: string;
    sk: string;
  };
  secondaryIndexes: {
    indexName: string;
    pk: string;
    sk: string;
  }[];
};

export const tableIndexes = {
  primary: {
    pk: "pk0",
    sk: "sk0",
  },
  secondary: [
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
  ],
};
