import { Mapper, SingleTableIndex } from "./mapper";
import { QueryBuilder } from './query-builder';
export declare class IndexQueryBuilder<Src> {
    mapper: Mapper<Src>;
    builder: QueryBuilder;
    index: SingleTableIndex<Src>;
    constructor(tableName: string, index: SingleTableIndex<Src>, mapper: Mapper<Src>);
    limit(t: number): this;
    sort(direction: 'asc' | 'desc'): this;
    cursor(str: 'string'): this;
    build(): {
        ExclusiveStartKey: object;
        ExpressionAttributeNames: {};
        ExpressionAttributeValues: {};
        KeyConditionExpression: string;
        TableName: string | undefined;
        ScanIndexForeward: boolean;
        Select: string;
    };
    where(src: Partial<Src>): this;
}
