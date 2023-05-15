import { z } from "zod";
import { Repository } from "../../repository";
import { getDocumentClient } from "./getDocumentClient";

export const getUserRepo = () =>
  new Repository({
    tableName: "table1",
    typeName: "User",
    schema: z.object({
      id: z.string(),
      name: z.string(),
      age: z.number(),
    }),
    primaryIndex: {
      tag: "primary",
      pk: "pk1",
      sk: "sk1",
      fields: ["id"],
    },
    secondaryIndexes: {
      name: {
        pk: "pk2",
        sk: "sk2",
        fields: ["name"],
        indexName: "gsi1",
      },
    },
    documentClient: getDocumentClient(),
  });
