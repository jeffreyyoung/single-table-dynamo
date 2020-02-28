import { AWS } from './AWS';
import { Repository } from './getRepository';
import { Index } from './config';
export declare const getTablesAndIndexes: (repos: Repository<any, any, string>[]) => {
    [tableName: string]: {
        [indexName: string]: Index<any, any>;
    };
};
export declare function getCreateTableInputs(repos: Repository[]): AWS.DynamoDB.CreateTableInput[];
export declare function ensureTableAndIndexesExist(repos: Repository[]): Promise<void>;
