import { BatchWriteItemOutput, DocumentClient } from 'aws-sdk/clients/dynamodb'

export type WriteRequest = {
  TableName: string
  Operation: DocumentClient.BatchWriteItemInput["RequestItems"][string][number]
}

const BATCH_WRITE_REQUEST_LIMIT = 25;

export async function batchWrite(ddb: DocumentClient, requestsIn: WriteRequest[]) {
  
  let unprocessed = requestsIn.slice(0);

  while (unprocessed.length > 0) {
    //take off 25
    let requests = unprocessed.splice(0, BATCH_WRITE_REQUEST_LIMIT);

    const res = await ddb.batchWrite(_convertRequestsToWriteInput(requests)).promise();

    unprocessed = unprocessed.concat(_unprocessedItemsToRequests(res.UnprocessedItems));
  }

  return requestsIn;
}


function _convertRequestsToWriteInput(requests: WriteRequest[]) {
  return requests.reduce<DocumentClient.BatchWriteItemInput>((prev, op) => {
    if (!prev.RequestItems[op.TableName]) {
      prev.RequestItems[op.TableName] = []
    }
    prev.RequestItems[op.TableName].push(op.Operation);
    return prev;
  }, {
    RequestItems: {

    }
  });
}

function _unprocessedItemsToRequests(items: BatchWriteItemOutput["UnprocessedItems"]) {
  const requests: WriteRequest[] = [];
  if (items) {
    Object.keys(items).forEach(TableName => {
      items[TableName].forEach(Operation => requests.push({
        TableName,
        Operation
      }))
    })

  }
  return requests;
}