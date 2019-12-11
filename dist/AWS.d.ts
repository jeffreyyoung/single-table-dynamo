import AWS from 'aws-sdk';
import { ConfigurationOptions } from 'aws-sdk/lib/config';
declare function getDocClient(): AWS.DynamoDB.DocumentClient;
export { AWS, getDocClient };
export declare function WORKAROUND_updateAWSConfig(ops: ConfigurationOptions, docClientOptions?: AWS.DynamoDB.DocumentClient.DocumentClientOptions): void;
