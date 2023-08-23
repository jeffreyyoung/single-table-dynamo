import DataLoader from "dataloader";
import {
  DynamoDBDocumentClient,
  GetCommandInput,
  GetCommandOutput,
} from "@aws-sdk/lib-dynamodb";
import { batchGet } from "./batch-get";

type GetArg = GetCommandInput;
type ReturnValue = GetCommandOutput;

export function createDataLoader(
  ddb: DynamoDBDocumentClient,
  { maxBatchSize = 100 } = {}
) {
  const loader = new DataLoader<GetArg, ReturnValue, string>(
    async (requests) => {
      const res = await batchGet(
        ddb,
        requests.map((r) => {
          if (!r.TableName) {
            throw new Error("TableName is required");
          }
          if (!r.Key) {
            throw new Error("Key is required");
          }
          return {
            TableName: r.TableName,
            Key: r.Key,
          };
        })
      );

      return res.map((item) => ({
        Item: item as any,
        $metadata: {},
      }));
    },
    {
      maxBatchSize,
      cacheKeyFn: (req) => {
        const key = `table=${req.TableName}__${Object.keys(req.Key!)
          .sort()
          .map((arg) => `${arg}=${req.Key![arg]}`)
          .join("__")}`;
        return key;
      },
    }
  );

  return loader;
}
