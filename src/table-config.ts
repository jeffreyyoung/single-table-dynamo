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
