# single-table-dynamo

A simple strongly typed dynamodb client that stores all items in a single table

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
    // a unique type name to distinguish this entity type from other types
    typeName: "User",

    // create a schema for the entity
    schema: z.object({
      id: z.string().default(() => uuid()),
      firstName: "harold",
      lastName: "kong",
    }),

    // define the id fields for this object
    primaryIndex: {
      fields: ["id"],
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

// write
const user = await repo.put({ firstName: "harold", lastName: "kong" });
// { id: "123", firstName: "harold", lastName: "kong" }

// read
const user = await repo.get({ id: "123" });

// update
const user = await repo.mutate({ id: "123", firstName: "dwight" });

// query
const { Items } = await repo
  .query("byFirstName")
  .where({ firstName: "dwight" })
  .exec();
// [{ id: "123", firstName: "dwight", lastName: "kong" }]

// delete
await repo.delete({ id: "123" });

// infer object type from repo
type UserObject = InferObjectType<typeof repo>;
// { id: string, firstName: string, lastName: string }

type UserId = InferIdType<typeof repo>;
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
