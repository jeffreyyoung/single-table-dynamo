import { SingleTableDocument } from './SingleTableDocument';
import { ConfigArgs, Index, Config } from './config';
import { KeyOfStr } from './utils';
export declare type WhereClause<T = any, QueryNames = string> = {
    sort?: 'asc' | 'desc';
    args: Partial<T>;
    index?: QueryNames;
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
export declare function getCompositeKeyValue<ID, T>(thing: T, properties: (keyof T | keyof ID)[], descriptor: string, separator: string): string;
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
export declare function dynamoProperty(key: string, value: string): string;
export declare function getSortkeyForBeginsWithQuery<ID, T>(thing: Partial<T>, indexFields: (keyof T | keyof ID)[], descriptor: string, compositeKeySeparator: string): string;
export declare function findIndexForQuery<ID, T, QueryNames>(where: WhereClause<T>, config: Config<ID, T, QueryNames>): Index<ID, T> | null;
declare type Queries<T, QueryNames> = Record<Extract<QueryNames, string>, (where: WhereClause<T>) => Promise<QueryResult<T>>>;
export declare type Repository<ID = any, T = any, QueryNames = string> = {
    config: Config<ID, T>;
    getKey: (id: ID) => any;
    get: (id: ID) => Promise<T | null>;
    update: (id: ID, updates: Partial<T>) => Promise<T>;
    overwrite: (thing: T) => Promise<T>;
    put: (thing: T) => Promise<T>;
    delete: (id: ID) => Promise<boolean>;
    formatForDDB: (thing: T) => SingleTableDocument<T>;
    executeQuery: (where: WhereClause<T>, index: Index<ID, T>) => Promise<QueryResult<T>>;
    query: (where: WhereClause<T>) => Promise<QueryResult<T>>;
    queryOne: (where: WhereClause<T>) => Promise<T | null>;
    findIndexForQuery: (where: WhereClause<T>) => Index<ID, T> | null;
    queries: Queries<T, QueryNames>;
};
export declare function getRepository<ID, T, QueryNames = string>(args: ConfigArgs<ID, T, QueryNames>): Repository<ID, T, QueryNames>;
export {};
