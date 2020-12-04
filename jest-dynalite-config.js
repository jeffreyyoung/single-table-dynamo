module.exports = {
  tables: [
    {
      TableName: "table1",
      KeySchema: [
        { AttributeName: "pk1", KeyType: "HASH" },
        { AttributeName: "sk1", KeyType: "RANGE"}
      ],
      AttributeDefinitions: [
        { AttributeName: "pk1", AttributeType: "S" },
        { AttributeName: "sk1", AttributeType: "S"},
        { AttributeName: "pk2", AttributeType: "S" },
        { AttributeName: "sk2", AttributeType: "S"},
      ],
      GlobalSecondaryIndexes: [{
        IndexName: 'gsi1',
        ProvisionedThroughput: {
          ReadCapacityUnits: 1,
          WriteCapacityUnits: 1,
        },
        KeySchema: [
          { AttributeName: "pk2", KeyType: "HASH" },
          { AttributeName: "sk2", KeyType: "RANGE"}
        ],
        Projection: {
          ProjectionType: 'ALL'
        }
      }],
      ProvisionedThroughput: {
        ReadCapacityUnits: 1,
        WriteCapacityUnits: 1,
      },
      data: [
      ],
    },
  ],
  basePort: 8000,
};