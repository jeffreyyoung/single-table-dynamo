import { DynamoDBDocumentClient as DocumentClient } from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
export function getDocumentClient() {
  let client = new DynamoDBClient({
    ...(process.env.MOCK_DYNAMODB_ENDPOINT && {
      endpoint: process.env.MOCK_DYNAMODB_ENDPOINT,
      sslEnabled: false,
      region: "local",
    }),
  });
  return DocumentClient.from(client);
}
