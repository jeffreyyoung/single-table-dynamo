import { z } from "zod";
import { Repository } from "../../repository";
import { getDocumentClient } from "./getDocumentClient";
import { tableConfig } from "./tableConfig";

export const getNoteRepo = () =>
  new Repository({
    tableName: tableConfig.tableName,
    typeName: "Note",
    schema: z.object({
      id: z.string(),
      owner: z.string(),
      tag: z.string(),
      name: z.string(),
      ageInYears: z.number().default(0),
      body: z.string().default(""),
    }),
    primaryIndex: {
      tag: "primary",
      ...tableConfig.primaryIndex,
      fields: ["id"],
    },
    secondaryIndexes: {
      name: {
        fields: ["name"],
        ...tableConfig.secondaryIndexes[0],
      },
      "tag,owner,name": {
        fields: ["tag", "owner", "name"],
        ...tableConfig.secondaryIndexes[1],
      },
    },
    documentClient: getDocumentClient(),
  });
