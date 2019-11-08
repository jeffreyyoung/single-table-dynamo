import { getLSIName, getLSISortKeyAttribute } from "./getRepository"
import AWS from "aws-sdk";
export type CreateTableArgs = {
    tableName?: string
}
import { CreateTableInput, LocalSecondaryIndex } from "aws-sdk/clients/dynamodb";
import { Index } from 'config';


let defaultTableName = 'SingleTable';

export function getDefaultTableName() {
    return defaultTableName;
}

export function setDefaultTableName(newName: string) {
    defaultTableName = newName;
}


function range(start: number, end: number) {
    let nums = [];
    for (let i = start; i <= end; i++) {
        nums.push(i);
    }
    return nums;
}

type LSI = {
    indexName: string
    sortKeyAttributeName: string
}

export function getGSIDef(index: Index<any, any>) {
    if (index.type === 'globalSecondaryIndex') {
        return {
            IndexName: index.indexName,
            KeySchema: [
                {AttributeName: index.hashKeyAttribute, KeyType: 'HASH'},
                {AttributeName: index.sortKeyAttribute, KeyType: 'Range'}
            ],
            Projection: {
                ProjectionType: 'INCLUDE',
                NonKeyAttributes: ['data', 'objectType']
            }
        } 
    }

    throw `given index of type ${index.type}, expecting globalSecondaryIndex`;
}

// type GSI = {
//     indexName: string
//     sortKeyAttributeName: string
//     hashKeyAttributeName: string
// }
/**
 * 
 * Creates a table with 5 local secondary indexes
 * 
 */
export function createTable(args: {tableName: string, indexes?: Index<any, any>[]}) {
    var client = new AWS.DynamoDB();

    let localSecondaryIndexes = range(0,4).map<LSI>(i => ({
        indexName: getLSIName(i),
        sortKeyAttributeName: getLSISortKeyAttribute(i)
    }));

    let globalSecondaryIndexes = (args.indexes || []).map((i) => getGSIDef(i));

    let createTableInput: CreateTableInput = {
        TableName: args.tableName || getDefaultTableName(),
        KeySchema: [
            {AttributeName: "hashKey", KeyType: "HASH"},
            {AttributeName: "sortKey", KeyType: "RANGE"}
        ],
        AttributeDefinitions: [
            {AttributeName: "hashKey", AttributeType: "string"},
            {AttributeName: "sortKey", AttributeType: "string"},
        ],
        LocalSecondaryIndexes: [
            ...localSecondaryIndexes.map<LocalSecondaryIndex>(i => ({
                IndexName: i.indexName,
                KeySchema: [
                    {AttributeName: i.sortKeyAttributeName, KeyType: 'RANGE'},
                    {AttributeName: 'hashKey', KeyType: 'HASH'}
                ],
                Projection: {
                    ProjectionType: 'INCLUDE',
                    NonKeyAttributes: ['data', 'objectType']
                }
            }))
        ],
        GlobalSecondaryIndexes: globalSecondaryIndexes,
        BillingMode: 'PAY_PER_REQUEST'
    }
    
    return client.createTable(createTableInput).promise();
}