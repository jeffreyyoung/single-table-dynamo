import { SingleTableDocumentWithData } from './SingleTableDocument';
import { ConfigArgs, Index, Config } from './config';
import { KeyOfStr } from './utils';
import { DocumentClient } from 'aws-sdk/clients/dynamodb';
declare class QueryBuilder<ID = any, T = any, IndexNames = string> {
    clause: WhereClause<T, IndexNames>;
    repo: Repository<ID, T, IndexNames>;
    constructor(repo: Repository<ID, T, IndexNames>);
    where(parts: Partial<T>): this;
    sortBy(key: KeyOfStr<T>): this;
    sortDirection(direction: 'asc' | 'desc'): this;
    index(index: IndexNames): this;
    cursor(cursor: Record<string, any>): this;
    limit(limit: number): this;
    setClause(clause: WhereClause<T, IndexNames>): this;
    get(): Promise<QueryResult<T>>;
    getOne(): Promise<T | null>;
    /**
     * Repeatedly pages over the given query until all items have been queried
     * If a query has more pages than fit in memory, errors will happen
     */
    getAll(): Promise<QueryResult<T>>;
    deleteAll(): Promise<boolean>;
}
export declare type WhereClause<T = any, IndexNames = string> = {
    sort?: 'asc' | 'desc';
    args: Partial<T>;
    index?: IndexNames;
    sortBy?: KeyOfStr<T>;
    cursor?: Record<string, any>;
    limit?: number;
};
export declare type QueryResult<T> = {
    results: T[];
    nextPageArgs?: WhereClause<T>;
};
/**
 *
 * @param thing
 * @param properties
 * @param descriptor
 * @param separator
 *
 * return "{descriptor}#{properties[0]}-{thing[properties[0]]}#..."
 */
export declare function getCompositeKeyValue<ID, T>(thing: T, properties: (keyof T | keyof ID)[], descriptor: string, separator: string, shouldPadNumbersInIndexes: boolean): string;
export declare function getCustomKeyValue<T>(thing: T, propertyName: (keyof T)): T[keyof T];
/**
 *
 * To make generic dynamo fields more readable, they are saved in the following format
 * <fieldName>-<fieldValue>, eg userId-2039848932
 *
 * This function should be used whenever saving attributes to a composite index
 *
 * @param key
 * @param value
 */
export declare function dynamoProperty(key: string, value: any, shouldPadNumbersInIndexes: boolean): string;
export declare function getSortkeyForBeginsWithQuery<ID, T>(thing: Partial<T>, indexFields: (keyof T | keyof ID)[], descriptor: string, compositeKeySeparator: string, shouldPadNumbersInIndexes: boolean): string;
export declare function findIndexForQuery<ID, T, QueryNames>(where: WhereClause<T, QueryNames>, config: Config<ID, T, QueryNames>): Index<ID, T> | null;
declare type IndexQueryBuilderMap<ID, T, QueryNames> = Record<Extract<QueryNames, string>, () => QueryBuilder<ID, T, QueryNames>>;
export declare type Repository<ID = any, T = any, IndexNames = string> = {
    config: Config<ID, T>;
    getKey: (id: ID) => any;
    get: (id: ID) => Promise<T | null>;
    update: (id: ID, updates: Partial<T>) => Promise<T>;
    overwrite: (thing: T) => Promise<T>;
    put: (thing: T) => Promise<T>;
    delete: (id: ID) => Promise<boolean>;
    batchDelete: (ids: ID[]) => Promise<boolean[]>;
    batchGet: (ids: ID[]) => Promise<(T | null)[]>;
    formatForDDB: (thing: T) => SingleTableDocumentWithData<T>;
    executeQuery: (where: WhereClause<T, IndexNames | any>, index: Index<ID, T>) => Promise<QueryResult<T>>;
    getSortKeyAndHashKeyForQuery(where: WhereClause<T, IndexNames | any>, index: Index<ID, T>): {
        sortKey: string;
        hashKey: string;
    };
    getQueryArgs(where: WhereClause<T, IndexNames | any>, index: Index<ID, T>): DocumentClient.QueryInput;
    query: (clause?: WhereClause<T, IndexNames | any>) => QueryBuilder<ID, T, IndexNames>;
    findIndexForQuery: (where: WhereClause<T, IndexNames | any>) => Index<ID, T> | null;
    getDocClient: () => AWS.DynamoDB.DocumentClient;
    indexes: IndexQueryBuilderMap<ID, T, IndexNames | any>;
    getCursor: (thing: T, index?: Index<ID, T>) => Record<string, any>;
};
export declare function getRepository<ID, T, QueryNames = string>(args: ConfigArgs<ID, T, QueryNames>): Repository<ID, T, QueryNames>;
export {};
