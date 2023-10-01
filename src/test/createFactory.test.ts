import { z } from "zod";
import { createFactory } from "./../repository";
import { tableConfig } from "./utils/tableConfig";
import { getDocumentClient } from "./utils/getDocumentClient";
import { createDataLoader } from "../data-loader";

test("create factory works", async () => {
  const docClient = getDocumentClient();
  const dataLoader = createDataLoader(docClient);

  const sendSpy = jest.spyOn(docClient, "send");

  const createRepo = createFactory({
    schema: z.object({
      id: z.string(),
      name: z.string(),
    }),
    tableName: tableConfig.tableName,
    primaryIndex: {
      ...tableConfig.primaryIndex,
      fields: ["id"],
    },
    documentClient: docClient,
    typeName: "Test",
  });

  const repo = createRepo({ dataLoader });

  await repo.put({ id: "1", name: "test" });

  expect(await repo.get({ id: "1" })).toEqual({ id: "1", name: "test" });
  expect(await repo.get({ id: "1" })).toEqual({ id: "1", name: "test" });
  expect(await repo.get({ id: "1" })).toEqual({ id: "1", name: "test" });
  expect(await repo.get({ id: "1" })).toEqual({ id: "1", name: "test" });

  expect(sendSpy).toHaveBeenCalledTimes(1);

  expect(await createRepo().get({ id: "1" })).toEqual({
    id: "1",
    name: "test",
  });

  expect(sendSpy).toHaveBeenCalledTimes(2);
});
