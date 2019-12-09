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
/**
 *
 * Creates a table with 5 local secondary indexes
 *
 */
export declare function createTable(args: {
    tableName: string;
    indexes?: Index<any, any>[];
}): Promise<void>;
