import { BatchWriteItemOutput, DocumentClient } from "aws-sdk/clients/dynamodb";
import { DataLoader } from "./mapper";

export type WriteRequest = PutRequest | DeleteRequest;

export type PutRequest<T = object> = {
  TableName: string;
  Operation: {
    PutRequest: {
      Item: T;
      Key: any;
    };
  };
};

export type DeleteRequest<T = object> = {
  TableName: string;
  Operation: {
    DeleteRequest: {
      Key: T;
    };
  };
};

const BATCH_WRITE_REQUEST_LIMIT = 25;

// https://stackoverflow.com/questions/51674820/generics-for-arrays-in-typescript-3-0
export async function batchPut<Requests extends Array<PutRequest>>(ops: {
  requests: Requests;
  ddb: DocumentClient;
  dataLoader?: DataLoader;
}): Promise<{
  [K in keyof Requests]: Requests[K] extends PutRequest<infer R>
    ? R
    : Requests[K];
}> {
  await batchWrite(ops);

  //@ts-ignore
  return ops.requests.map((r) => r.Operation.PutRequest.Item);
}

export async function batchWrite<
  Requests extends Array<PutRequest | DeleteRequest>
>({
  ddb,
  requests: requestsIn,
  dataLoader,
}: {
  ddb: DocumentClient;
  requests: Requests;
  dataLoader?: DataLoader;
}): Promise<{
  [K in keyof Requests]: Requests[K] extends PutRequest<infer R> ? R : true;
}> {
  let unprocessed = requestsIn.slice(0);

  while (unprocessed.length > 0) {
    //take off 25
    const requests = unprocessed.splice(0, BATCH_WRITE_REQUEST_LIMIT);

    const res = await ddb
      .batchWrite(_convertRequestsToWriteInput(requests))
      .promise();
    if (dataLoader) {
      requests.map((r) => {
        if (isPutRequest(r)) {
          const key = {
            TableName: r.TableName,
            Key: r.Operation.PutRequest.Key,
          };
          dataLoader.clear(key);
          dataLoader.prime(key, r.Operation.PutRequest as any);
        } else {
          const key = {
            TableName: r.TableName,
            Key: r.Operation.DeleteRequest.Key,
          };
          dataLoader.clear({
            TableName: r.TableName,
            Key: r.Operation.DeleteRequest.Key,
          });
          dataLoader.prime(key, {
            $response: {} as any,
          });
        }
      });
    }

    unprocessed = unprocessed.concat(
      _unprocessedItemsToRequests(res.UnprocessedItems)
    );
  }

  //@ts-ignore
  return requestsIn.map((r) => {
    if (isPutRequest(r)) {
      return r.Operation.PutRequest.Item;
    } else {
      return true;
    }
  });
}

function isPutRequest(r: WriteRequest): r is PutRequest {
  const temp = r as PutRequest;
  return Boolean(temp?.Operation?.PutRequest?.Item);
}

function _convertRequestsToWriteInput(requests: WriteRequest[]) {
  return requests.reduce<DocumentClient.BatchWriteItemInput>(
    (prev, op) => {
      if (!prev.RequestItems[op.TableName]) {
        prev.RequestItems[op.TableName] = [];
      }
      prev.RequestItems[op.TableName].push(op.Operation);
      return prev;
    },
    {
      RequestItems: {},
    }
  );
}

function _unprocessedItemsToRequests(
  items: BatchWriteItemOutput["UnprocessedItems"]
) {
  const requests: WriteRequest[] = [];
  if (items) {
    Object.keys(items).forEach((TableName) => {
      items[TableName].forEach((Operation) =>
        requests.push({
          TableName,
          Operation: Operation as any,
        })
      );
    });
  }
  return requests;
}
