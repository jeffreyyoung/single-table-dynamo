import { AWS } from './AWS';
import { Index } from './config';
export declare type CreateTableArgs = {
    tableName?: string;
};
export declare function getDefaultTableName(): string;
export declare function setDefaultTableName(newName: string): void;
export declare function getGSIDef(index: Index<any, any>): {
    IndexName: string;
    KeySchema: {
        AttributeName: string;
        KeyType: string;
    }[];
    Projection: {
        ProjectionType: string;
    };
};
export declare function getCreateTableInput(args: {
    tableName: string;
    indexes?: Index<any, any>[];
}): AWS.DynamoDB.CreateTableInput;
/**
 *
 * Creates a table with 5 local secondary indexes
 *
 */
export declare function createTable(args: {
    tableName: string;
    indexes?: Index<any, any>[];
}): Promise<void>;
