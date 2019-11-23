import AWS from 'aws-sdk';
import { ConfigurationOptions } from 'aws-sdk/lib/config';

let _docClient = new AWS.DynamoDB.DocumentClient();

function getDocClient() {
  return _docClient;
}

export { AWS, getDocClient };

export function WORKAROUND_updateAWSConfig(ops: ConfigurationOptions) {
  AWS.config.update(ops);
  _docClient = new AWS.DynamoDB.DocumentClient(ops);
}
