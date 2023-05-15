import DataLoader from "dataloader";
import { DocumentClient } from "aws-sdk/clients/dynamodb";
import { batchGet } from "./batch-get";

type GetArg = Parameters<DocumentClient["get"]>[0];
type ReturnValue = Awaited<
  ReturnType<ReturnType<DocumentClient["get"]>["promise"]>
>;

export function createDataLoader(
  ddb: DocumentClient,
  { maxBatchSize = 100 } = {}
) {
  const loader = new DataLoader<GetArg, ReturnValue, string>(
    async (requests) => {
      const res = await batchGet(ddb, requests);

      return res.map((item) => ({
        Item: item as any,
        $response: "" as any,
      }));
    },
    {
      maxBatchSize,
      cacheKeyFn: (req) => {
        const key = `table=${req.TableName}__${Object.keys(req.Key)
          .sort()
          .map((arg) => `${arg}=${req.Key[arg]}`)
          .join("__")}`;
        return key;
      },
    }
  );

  return loader;
}
