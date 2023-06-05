module.exports = {
  tables: [
    {
      TableName: "THINGS_TABLE",
      KeySchema: [
        {
          AttributeName: "pk0",
          KeyType: "HASH",
        },
        {
          AttributeName: "sk0",
          KeyType: "RANGE",
        },
      ],
      AttributeDefinitions: [
        {
          AttributeName: "pk0",
          AttributeType: "S",
        },
        {
          AttributeName: "sk0",
          AttributeType: "S",
        },
        {
          AttributeName: "pk1",
          AttributeType: "S",
        },
        {
          AttributeName: "sk1",
          AttributeType: "S",
        },
        {
          AttributeName: "pk2",
          AttributeType: "S",
        },
        {
          AttributeName: "sk2",
          AttributeType: "S",
        },
        {
          AttributeName: "pk3",
          AttributeType: "S",
        },
        {
          AttributeName: "sk3",
          AttributeType: "S",
        },
        {
          AttributeName: "pk4",
          AttributeType: "S",
        },
        {
          AttributeName: "sk4",
          AttributeType: "S",
        },
        {
          AttributeName: "pk5",
          AttributeType: "S",
        },
        {
          AttributeName: "sk5",
          AttributeType: "S",
        },
        {
          AttributeName: "pk6",
          AttributeType: "S",
        },
        {
          AttributeName: "sk6",
          AttributeType: "S",
        },
        {
          AttributeName: "pk7",
          AttributeType: "S",
        },
        {
          AttributeName: "sk7",
          AttributeType: "S",
        },
      ],
      BillingMode: "PAY_PER_REQUEST",
      GlobalSecondaryIndexes: [
        {
          IndexName: "gsi1",
          KeySchema: [
            {
              AttributeName: "pk1",
              KeyType: "HASH",
            },
            {
              AttributeName: "sk1",
              KeyType: "RANGE",
            },
          ],
          Projection: {
            ProjectionType: "ALL",
          },
        },
        {
          IndexName: "gsi2",
          KeySchema: [
            {
              AttributeName: "pk2",
              KeyType: "HASH",
            },
            {
              AttributeName: "sk2",
              KeyType: "RANGE",
            },
          ],
          Projection: {
            ProjectionType: "ALL",
          },
        },
        {
          IndexName: "gsi3",
          KeySchema: [
            {
              AttributeName: "pk3",
              KeyType: "HASH",
            },
            {
              AttributeName: "sk3",
              KeyType: "RANGE",
            },
          ],
          Projection: {
            ProjectionType: "ALL",
          },
        },
        {
          IndexName: "gsi4",
          KeySchema: [
            {
              AttributeName: "pk4",
              KeyType: "HASH",
            },
            {
              AttributeName: "sk4",
              KeyType: "RANGE",
            },
          ],
          Projection: {
            ProjectionType: "ALL",
          },
        },
        {
          IndexName: "gsi5",
          KeySchema: [
            {
              AttributeName: "pk5",
              KeyType: "HASH",
            },
            {
              AttributeName: "sk5",
              KeyType: "RANGE",
            },
          ],
          Projection: {
            ProjectionType: "ALL",
          },
        },
        {
          IndexName: "gsi6",
          KeySchema: [
            {
              AttributeName: "pk6",
              KeyType: "HASH",
            },
            {
              AttributeName: "sk6",
              KeyType: "RANGE",
            },
          ],
          Projection: {
            ProjectionType: "ALL",
          },
        },
        {
          IndexName: "gsi7",
          KeySchema: [
            {
              AttributeName: "pk7",
              KeyType: "HASH",
            },
            {
              AttributeName: "sk7",
              KeyType: "RANGE",
            },
          ],
          Projection: {
            ProjectionType: "ALL",
          },
        },
      ],
    },
    {
      TableName: "table1",
      KeySchema: [
        { AttributeName: "pk1", KeyType: "HASH" },
        { AttributeName: "sk1", KeyType: "RANGE" },
      ],
      AttributeDefinitions: [
        { AttributeName: "pk1", AttributeType: "S" },
        { AttributeName: "sk1", AttributeType: "S" },
        { AttributeName: "pk2", AttributeType: "S" },
        { AttributeName: "sk2", AttributeType: "S" },
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: "gsi1",
          ProvisionedThroughput: {
            ReadCapacityUnits: 1,
            WriteCapacityUnits: 1,
          },
          KeySchema: [
            { AttributeName: "pk2", KeyType: "HASH" },
            { AttributeName: "sk2", KeyType: "RANGE" },
          ],
          Projection: {
            ProjectionType: "ALL",
          },
        },
      ],
      ProvisionedThroughput: {
        ReadCapacityUnits: 1,
        WriteCapacityUnits: 1,
      },
      data: [],
    },
  ],
  basePort: 45632,
};
