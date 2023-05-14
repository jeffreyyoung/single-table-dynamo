# Single Table Dynamodb

There are a few other dynamodb clients that help simplify using dynamodb in a node environment, but most encourage the use of multiple tables. This client is built with the idea of storing all data in a single table. It is built with typescript and is strongly typed https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-general-nosql-design.html

## Getting started

```
yarn add single-table-dynamo zod
```

## Example

```typescript
import { DocumentClient } from "aws-sdk/clients/dynamodb";
import { z } from "zod";

// create a repository that can be used for CRUD/Query operations
const repo = new Repository(
  {
    // a unique type name for this entity
    typeName: "User",

    // create a schema for the entity
    schema: z.object({
      id: z.string().default(() => uuid()),
      firstName: "harold",
      lastName: "kong",
    }),

    // define the id fields for this object
    primaryIndex: {
      fields: ["page"],
    },

    // define secondaryIndexes that can be used for additional queries
    secondaryIndexes: {
      byFirstName: {
        fields: ["firstName", "lastName"],
      },
      byLastName: {
        fields: ["lastName", "firstName"],
      },
    },

    tableConfig: TableConfig,
  },
  new DocumentClient()
);

const user = await repo.put({ firstName: "harold", lastName: "kong" });
// { id: "123", firstName: "harold", lastName: "kong" }

const user = await repo.get({ id: "123" });
// { id: "123", firstName: "harold", lastName: "kong" }

const user = await repo.mutate({ id: "123", firstName: "dwight" });
// { id: "123", firstName: "dwight", lastName: "kong" }

const { Items } = await repo
  .query("byFirstName")
  .where({ firstName: "dwight" })
  .exec();
// [{ id: "123", firstName: "dwight", lastName: "kong" }]

await repo.delete({ id: "123" });

// infer object type from repo
type O = InferObjectType<typeof repo>;
// { id: string, firstName: string, lastName: string }

type Id = InferIdType<typeof repo>;
// {id: string}

var TableConfig = {
  tableName: "GenericTable",
  primaryIndex: {
    pk: "pk1",
    sk: "sk0",
  },
  secondaryIndexes: [
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
  ],
};
```
