import { DocumentClient } from "aws-sdk/clients/dynamodb";

export function getDocumentClient() {
  return new DocumentClient({
    ...(process.env.MOCK_DYNAMODB_ENDPOINT && {
      endpoint: process.env.MOCK_DYNAMODB_ENDPOINT,
      sslEnabled: false,
      region: 'local',
    }),
  });
}