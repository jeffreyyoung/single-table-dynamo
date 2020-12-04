module.exports = {
  tables: [
    {
      TableName: "table",
      KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
      AttributeDefinitions: [{ AttributeName: "id", AttributeType: "S" }],
      ProvisionedThroughput: {
        ReadCapacityUnits: 1,
        WriteCapacityUnits: 1,
      },
      data: [
        {
          id: "a",
          someattribute: "hello world",
        },
      ],
    },
  ],
  basePort: 8000,
};