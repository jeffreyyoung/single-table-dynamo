import { AWS } from './AWS';
export declare type CreateTableArgs = {
    tableName?: string;
};
import { Index } from './config';
export declare function getDefaultTableName(): string;
export declare function setDefaultTableName(newName: string): void;
export declare function getGSIDef(index: Index<any, any>): {
    IndexName: string;
    KeySchema: {
        AttributeName: "hashKey" | "sortKey" | "data" | "objectType" | "lsi0" | "lsi1" | "lsi2" | "lsi3" | "lsi4" | "gsiHash0" | "gsiSort0" | "gsiHash1" | "gsiSort1" | "gsiHash2" | "gsiSort2" | "gsiHash3" | "gsiSort3" | "gsiHash4" | "gsiSort4" | "gsiHash5" | "gsiSort5" | "gsiHash6" | "gsiSort6" | "gsiHash7" | "gsiSort7" | "gsiHash8" | "gsiSort8" | "gsiHash9" | "gsiSort9" | "gsiHash10" | "gsiSort10" | "gsiHash11" | "gsiSort11";
        KeyType: string;
    }[];
    Projection: {
        ProjectionType: string;
        NonKeyAttributes: string[];
    };
};
/**
 *
 * Creates a table with 5 local secondary indexes
 *
 */
export declare function createTable(args: {
    tableName: string;
    indexes?: Index<any, any>[];
}): Promise<import("aws-sdk/lib/request").PromiseResult<AWS.DynamoDB.CreateTableOutput, AWS.AWSError>>;
