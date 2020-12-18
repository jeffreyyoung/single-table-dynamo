import { DocumentClient } from 'aws-sdk/clients/dynamodb'

export type GetRequest = {
  TableName: string
  Key: any
}

const BATCH_GET_REQUEST_LIMIT = 100;

export async function batchGet<T = any>(ddb: DocumentClient, requestsIn: GetRequest[]) {
  //Here we register the primary partition and sort key fields for each table
  const tableToKeyFields: Record<string, string[]> = {};

  //here we cache the order of all the requests
  const stringKeys = requestsIn.map((r) => {
    tableToKeyFields[r.TableName] = Object.keys(r.Key);
    return getStringKey(r);
  });
  
  const stringKeyToResult = {};


  let unprocessed: GetRequest[] = requestsIn.slice(0);

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

  return stringKeys.map<T>(r => stringKeyToResult[r]);
}

function getKeyFromItem(keyFields: string[], item: any) {
  return keyFields.reduce((prev, attr) => ({...prev, [attr]: item[attr]}), {});
}

function getStringKey(request: GetRequest) {
  return request.TableName + JSON.stringify(request.Key);
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