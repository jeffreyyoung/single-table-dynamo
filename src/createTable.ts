import { getLSIName, getLSISortKeyAttribute, getGSIName, getGSIAttributeName } from "./getRepository"
import AWS from "aws-sdk";
export type CreateTableArgs = {
    tableName?: string
}
import { CreateTableInput, LocalSecondaryIndex, GlobalSecondaryIndex, AttributeDefinition, AttributeDefinitions } from "aws-sdk/clients/dynamodb";
import {flatten} from 'lodash';

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

type GSI = {
    indexName: string
    sortKeyAttributeName: string
    hashKeyAttributeName: string
}
/**
 * 
 * Creates a table with 5 local secondary indexes, and 20 global secondary indexes
 * 
 */
export function createTable(args: {tableName: string}) {
    var client = new AWS.DynamoDB();

    let localSecondaryIndexes = range(0,4).map<LSI>(i => ({
        indexName: getLSIName(i),
        sortKeyAttributeName: getLSISortKeyAttribute(i)
    }));

    let globalSecondaryIndexes = range(0,19).map<GSI>(i => ({
        indexName: getGSIName(i),
        sortKeyAttributeName: getGSIAttributeName(i, 'Sort'),
        hashKeyAttributeName: getGSIAttributeName(i, 'Hash'),
    }));


    let createTableInput: CreateTableInput = {
        TableName: args.tableName || getDefaultTableName(),
        KeySchema: [
            {AttributeName: "hashKey", KeyType: "HASH"},
            {AttributeName: "sortKey", KeyType: "RANGE"}
        ],
        AttributeDefinitions: [
            {AttributeName: "hashKey", AttributeType: "string"},
            {AttributeName: "sortKey", AttributeType: "string"},
            ...localSecondaryIndexes.map<AttributeDefinition>(i => ({
                AttributeName: i.sortKeyAttributeName, AttributeType: "string"
            })),
            ...flatten(globalSecondaryIndexes.map<AttributeDefinitions>(i => ([
                {AttributeName: i.hashKeyAttributeName, AttributeType: 'string'},
                {AttributeName: i.sortKeyAttributeName, AttributeType: 'string'}
            ])))
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
                    NonKeyAttributes: ['data']
                }
            }))
        ],
        GlobalSecondaryIndexes: [
            ...globalSecondaryIndexes.map<GlobalSecondaryIndex>(i => ({
                IndexName: i.indexName,
                KeySchema: [
                    {AttributeName: i.hashKeyAttributeName, KeyType: 'HASH'},
                    {AttributeName: i.sortKeyAttributeName, KeyType: 'Range'}
                ],
                Projection: {
                    ProjectionType: 'INCLUDE',
                    NonKeyAttributes: ['data']
                },
            }))
        ],
        BillingMode: 'PAY_PER_REQUEST'
    }
    
    return client.createTable(createTableInput).promise();
}