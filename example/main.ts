import { DynamoDBDocumentClient as DocumentClient } from "@aws-sdk/lib-dynamodb";
import { z } from "zod";
import { Repository, InferObjectType, InferIdType } from "../src";

const TableConfig = {
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

// create a repository that can be used for CRUD/Query operations
const repo = new Repository({
  // create a schema for the objects to store in dynamodb
  schema: z.object({
    id: z.string(),
    country: z.string(),
    state: z.string(),
    city: z.string(),
  }),

  // define the id fields for this object
  primaryIndex: {
    fields: ["id"],
    ...TableConfig.primaryIndex,
  },

  // define secondaryIndexes that can be used for additional queries
  secondaryIndexes: {
    byCountryByStateByCity: {
      fields: ["country", "state", "city"],
      ...TableConfig.secondaryIndexes[0],
    },
  },

  tableName: TableConfig.tableName,
  typeName: "User",
  documentClient: new DocumentClient(),
});

// get an object
const user = repo.get({ id: "user1" });

// delete
repo.delete({ id: "user1" });

// create
const newUser = repo.put({
  id: "user1",
  city: "otis",
  state: "kansas",
  country: "usa",
});

// query
const results = repo.query("fasdlkf").where({ country: "usa" }).exec();

// extract entity type from repo
type O = InferObjectType<typeof repo>; // {id: string, country: string, city: string, state: string }

// extract id type from repo
type Id = InferIdType<typeof repo>; // {id: string}
