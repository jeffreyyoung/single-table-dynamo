import { z } from "zod";
import { Repository } from "../repository";
import { getDocumentClient } from "./utils/getDocumentClient";
import { tableConfig } from "./utils/tableConfig";

const repo = new Repository({
  schema: z.object({
    name: z.string().default("tammy"),
    id: z.string().default(() => "id" + Math.random() + ""),
  }),
  primaryIndex: {
    fields: ["id"],
    ...tableConfig.primaryIndex,
  },
  tableName: tableConfig.tableName,
  typeName: "person",
  documentClient: getDocumentClient(),
});

test("id should be generated", async () => {
  const res = await repo.put({});
  expect(res).toMatchObject({
    name: "tammy",
    id: expect.stringContaining("id"),
  });
});

test("should not override fields", async () => {
  const res = await repo.put({
    name: "jonny",
    id: "123",
  });

  expect(res).toEqual({
    name: "jonny",
    id: "123",
  });
});
