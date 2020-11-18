declare type Operator = "EQ" | "NE" | "IN" | "LE" | "LT" | "GE" | "GT" | "BETWEEN" | "NOT_NULL" | "NULL" | "CONTAINS" | "NOT_CONTAINS" | "BEGINS_WITH";
declare type Where = {
    fieldName: string;
    operator: Operator;
    value: string | number;
};
/**
 * Encapsulates all data needed to generate
 * query
 */
export declare type QueryData = {
    keyConditions: Where[];
    sortOrder: 'asc' | 'desc';
    limit: number;
    indexName?: string;
    tableName?: string;
    /**
     * The key of the last fetched object
     */
    cursor?: object;
};
export declare class QueryBuilder {
    data: QueryData;
    constructor();
    table(tabeName: string): this;
    index(indexName: string): this;
    sort(direction: 'asc' | 'desc'): this;
    limit(l: number): this;
    cursor(l: object): this;
    where(key: string, op: Operator, value: string | number): this;
    build(): {
        ExclusiveStartKey: object;
        ExpressionAttributeNames: {};
        ExpressionAttributeValues: {};
        KeyConditionExpression: string;
        TableName: string | undefined;
        ScanIndexForeward: boolean;
        Select: string;
    } | {
        ExclusiveStartKey?: undefined;
        ExpressionAttributeNames: {};
        ExpressionAttributeValues: {};
        KeyConditionExpression: string;
        TableName: string | undefined;
        ScanIndexForeward: boolean;
        Select: string;
    } | {
        ExclusiveStartKey: object;
        ExpressionAttributeNames: {};
        ExpressionAttributeValues: {};
        KeyConditionExpression: string;
        TableName: string | undefined;
        ScanIndexForeward: boolean;
        Select: string;
    } | {
        ExclusiveStartKey?: undefined;
        ExpressionAttributeNames: {};
        ExpressionAttributeValues: {};
        KeyConditionExpression: string;
        TableName: string | undefined;
        ScanIndexForeward: boolean;
        Select: string;
    } | {
        ExclusiveStartKey: object;
        ExpressionAttributeNames: {};
        ExpressionAttributeValues: {};
        KeyConditionExpression: string;
        IndexName: string;
        TableName: string | undefined;
        ScanIndexForeward: boolean;
        Select: string;
    } | {
        ExclusiveStartKey?: undefined;
        ExpressionAttributeNames: {};
        ExpressionAttributeValues: {};
        KeyConditionExpression: string;
        IndexName: string;
        TableName: string | undefined;
        ScanIndexForeward: boolean;
        Select: string;
    };
    _buildConditionExpression(): {
        ExpressionAttributeNames: {};
        ExpressionAttributeValues: {};
        KeyConditionExpression: string;
    };
    _buildCursor(): {
        ExclusiveStartKey: object;
    } | {
        ExclusiveStartKey?: undefined;
    };
}
export {};
