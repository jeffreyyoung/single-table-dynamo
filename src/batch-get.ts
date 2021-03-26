import { DocumentClient } from 'aws-sdk/clients/dynamodb'

export type GetRequest<ReturnType = any> = {
  TableName: string
  Key: any
  _res?: ReturnType
}

const BATCH_GET_REQUEST_LIMIT = 100;

export async function batchGet<Requests extends readonly GetRequest[]>(ddb: DocumentClient, requestsIn: Requests): Promise<
{ [K in keyof Requests]: Requests[K] extends GetRequest<infer R> ? R : undefined }
> {
  //Here we register the primary partition and sort key fields for each table
  const tableToKeyFields: Record<string, string[]> = {};
  //here we cache the order of all the requests
  const stringKeys = requestsIn.map((r) => {
    tableToKeyFields[r.TableName] = Object.keys(r.Key);
    return getStringKey(r);
  });

  const stringKeyToResult = {};

  const uniqRequests = uniqueBy(requestsIn as any as GetRequest<any>[], getStringKey);

  let unprocessed: GetRequest[] = uniqRequests.slice(0);

  while (unprocessed.length > 0) {
    //take off 25
    let requests = unprocessed.splice(0, BATCH_GET_REQUEST_LIMIT);

    const res = await ddb.batchGet(_convertRequestsToBatchGetInput(requests)).promise();
    if (res.Responses) {
      Object.entries(res.Responses).forEach(([TableName, items]) => {
        items.forEach(item => {
          const Key = getKeyFromItem(tableToKeyFields[TableName], item);
          const stringKey = getStringKey({TableName, Key});
          stringKeyToResult[stringKey] = item
        })
      })
    }
    unprocessed = unprocessed.concat(_unprocessedItemsToRequests(res.UnprocessedKeys));
  }

  //@ts-expect-error
  return stringKeys.map(r => stringKeyToResult[r]);
}

function getKeyFromItem(keyFields: string[], item: any) {
  return keyFields.reduce((prev, attr) => ({...prev, [attr]: item[attr]}), {});
}

function getStringKey(request: GetRequest) {
  return request.TableName + Object.keys(request.Key).sort().map(prop => `${prop}:${request.Key[prop]}`);
}

function uniqueBy<T>(things:T[], fn: (arg: T) => string) {
  const thingsByKey: Record<string, T> = {};
  things.forEach(thing => thingsByKey[fn(thing)] = thing);

  return Array.from(new Set(Object.keys(thingsByKey))).map(k => thingsByKey[k]);
}

function _convertRequestsToBatchGetInput(requests: GetRequest[]) {
  return requests.reduce<DocumentClient.BatchGetItemInput>((prev, req) => {
    if (!prev.RequestItems[req.TableName]) {
      prev.RequestItems[req.TableName] = {
        Keys: []
      }
    }
    prev.RequestItems[req.TableName].Keys.push(req.Key)
    return prev;
  }, {
    RequestItems: {

    }
  });
}

function _unprocessedItemsToRequests(items: DocumentClient.BatchGetItemOutput["UnprocessedKeys"]) {
  const requests: GetRequest[] = [];
  if (items) {
    Object.keys(items).forEach(TableName => {
      items[TableName].Keys.forEach(Key => requests.push({Key, TableName}))
    })
  }
  return requests;
}