import AWS from "aws-sdk";
import {Repository} from './getRepository';
import { Index } from 'config';
import { createTable, getGSIDef } from 'createTable';


export async function ensureTableAndIndexesExist(repos: Repository[]) {
    let tables: {
        [tableName: string]: {
            [indexName: string]: Index<any, any>
        }
    } = {};
    
    repos.map(c => c.config).forEach(c => {
        if (!tables[c.tableName]) {
            tables[c.tableName] = {};
        }
        c.indexes.forEach(i => {
            if (i.type === 'globalSecondaryIndex') {
                tables[c.tableName][i.indexName] = i;
            }
        });
    });

    let tableNames = Object.keys(tables);

    for (let i = 0; i < tableNames.length; i++) {
        let tableName = tableNames[i];
        await ensureTableIsConfigured(tableNames[i], tables[tableName]);
    }
}

async function getTableDescription(client: AWS.DynamoDB, tableName: string): Promise<AWS.DynamoDB.TableDescription | null> {
    try {
        let description = await client.describeTable({TableName: tableName}).promise();
        if (description.Table) {
            return description.Table;
        }
    } catch (e) {
        console.log(e);
    } finally {
        return null;
    }
}

async function ensureTableIsConfigured(tableName: string, indexes: Record<string, Index<any,any>>) {
    const client = new AWS.DynamoDB();
    console.log(`checking if the table "${tableName}" has already been created`);
    
    let table = await getTableDescription(client, tableName);
    let indexesToBeCreated = {...indexes};

    if (!table) {
        let ins = Object.values(indexesToBeCreated)
        console.log(`table "${tableName}" does not exist, creating it now`);
        await createTable({tableName, indexes: ins});
        console.log(`table "${tableName}" created with the following indexes ${Object.keys(indexesToBeCreated).join(',')}`);
        return;
    }
    
    console.log(`table "${tableName}" already exists, checking the indexes`);

    if (table) {
        (table.GlobalSecondaryIndexes || []).forEach(i => {
            delete indexesToBeCreated[i.IndexName || '']
        });
    }
    let toCreate = Object.values(indexesToBeCreated);
    if (toCreate.length > 0) {
        console.log(`creating the following indexes ${Object.keys(indexesToBeCreated).join(',')} to table ${tableName}`)
        await client.updateTable({
            TableName: tableName,
            GlobalSecondaryIndexUpdates: toCreate.map(i => ({
                Create: getGSIDef(i)
            }))
        }).promise();

    } else {
        console.log(`the table ${tableName} has all the necessary indexes`);
    }


}