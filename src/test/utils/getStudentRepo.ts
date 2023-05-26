import { z } from "zod";
import { Repository } from "../../repository";
import { getDocumentClient } from "./getDocumentClient";
import { tableConfig } from "./tableConfig";

export const getStudentRepo = () =>
  new Repository({
    tableName: tableConfig.tableName,
    typeName: "Student",
    schema: z.object({
      id: z.string(),
      first: z.string(),
      last: z.string(),
      grade: z.number().default(0),
    }),
    primaryIndex: {
      tag: "primary",
      ...tableConfig.primaryIndex,
      fields: ["id"],
    },
    secondaryIndexes: {
      "last,first": {
        fields: ["last", "first"],
        ...tableConfig.secondaryIndexes[0],
      },
      "first,last": {
        fields: ["first", "last"],
        ...tableConfig.secondaryIndexes[1],
      },
    },
    documentClient: getDocumentClient(),
  });
