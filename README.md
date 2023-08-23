# single-table-dynamo

A simple strongly typed dynamodb client that stores all items in a single table

## Getting started

```
yarn add single-table-dynamo zod
```

## Example

```typescript
import { DynamoDBDocumentClient as DocumentClient } from "@aws-sdk/lib-dynamodb";
import { z } from "zod";
import { Repository, InferObjectType, InferIdType } from "single-table-dynamo";

const repo = new Repository({
  // a unique type name to distinguish this entity type from other types
  typeName: "Note",

  // create a schema for the entity
  schema: z.object({
    id: z.string().default(() => uuid()),
    owner: z.string(),
    text: z.string().min(0).max(1000).default(""),
  }),

  // primary index fields are required to get this object
  primaryIndex: {
    fields: ["id"],
  },

  // can be used query by other ids
  secondaryIndexes: {
    byOwner: {
      fields: ["owner"],
      indexName: "gsi1",
    },
  },

  tableConfig: TableConfig,

  documentClient: new DocumentClient(),
});

// write
const note = await repo.put({ owner: "harold" });
// { id: "123", owner: "harold", text: "" }

// read
const note = await repo.get({ id: "123" });
// { id: "123", owner: "harold", text: "" }

// update
const note = await repo.mutate({ id: "123", text: "this is my note" });
// { id: "123", owner: "harold", text: "this is my note" }

// query
const { Items } = await repo.query("byOwner").where({ owner: "harold" }).exec();
// [{ id: "123", owner: "harold", text: "this is my note" }]

// delete
await repo.delete({ id: "123" });

// infer object type from repo
type NoteObject = InferObjectType<typeof repo>;
// { id: string, owner: string, text: string }

type NoteId = InferIdType<typeof repo>;
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
