import { SingleTableDocument } from './SingleTableDocument';
import { KeyOfStr } from './utils';
export declare type PropList<T> = KeyOfStr<T>[];
export declare type PropList2<A, B> = (KeyOfStr<A> | KeyOfStr<B>)[];
declare type BaseIndex<ID, T> = {
    isCustomIndex: boolean;
    hashKeyFields: PropList2<ID, T>;
    hashKeyDescriptor: string;
    hashKeyAttribute: keyof SingleTableDocument | KeyOfStr<T>;
    sortKeyFields: PropList2<ID, T>;
    sortKeyDescriptor: string;
    sortKeyAttribute: keyof SingleTableDocument | KeyOfStr<T>;
    tag?: string;
};
export declare type Index<ID, T> = ({
    type: 'primaryIndex';
} | {
    type: 'localSecondaryIndex' | 'globalSecondaryIndex';
    indexName: string;
}) & BaseIndex<ID, T>;
export declare function getPrimaryIndex<ID, T>(config: ConfigArgs<ID, T>, tag?: string): Index<ID, T>;
export declare function convertQueryArgToIndex<ID, T>(queryName: string, config: ConfigArgs<ID, T>): Index<ID, T>;
export declare function getLSIIndex<ID, T>(queryName: string, i: LSIQueryArg<T>, config: ConfigArgs<ID, T>): Index<ID, T>;
export declare function getCustomGSIIndex<ID, T>(queryName: string, i: CustomGSIQueryArg<T>, config: ConfigArgs<ID, T>): Index<ID, T>;
export declare function getGSIIndex<ID, T>(queryName: string, i: GSIQueryArg<T>, config: ConfigArgs<ID, T>): Index<ID, T>;
declare type PrimaryQueryArg = {
    isPrimary: true;
};
declare type LSIQueryArg<T> = {
    sortKeyFields: PropList<T>;
    type?: 'localSecondaryIndex';
    which: 0 | 1 | 2 | 3 | 4;
};
declare type CustomGSIQueryArg<T> = {
    type: 'globalSecondaryIndex';
    hashKeyAttributeName: KeyOfStr<T>;
    sortKeyAttributeName: KeyOfStr<T>;
    indexName?: string;
};
declare type GSIQueryArg<T> = {
    sortKeyFields: PropList<T>;
    hashKeyFields: PropList<T>;
    type?: 'globalSecondaryIndex';
    which: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19;
};
export declare type ConfigArgs<ID, T, QueryNames = string> = {
    tableName?: string;
    objectName: string;
    hashKeyFields: PropList<ID>;
    sortKeyFields?: PropList<ID>;
    compositeKeySeparator?: '#';
    shouldPadNumbersInIndexes?: boolean;
    paddedNumberLength?: number;
    indexes?: Record<Extract<QueryNames, string>, GSIQueryArg<T> | LSIQueryArg<T> | PrimaryQueryArg | CustomGSIQueryArg<T>>;
};
declare type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
declare type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export declare function getConfig<ID, T>(argsIn: PartialBy<ConfigArgs<ID, T>, 'indexes'>): Config<ID, T>;
export declare type Config<ID, T, QueryNames = string> = Readonly<{
    tableName: string;
    objectName: string;
    primaryIndex: Index<ID, T>;
    indexes: Index<ID, T>[];
    paddedNumberLength: number;
    shouldPadNumbersInIndexes: boolean;
    indexesByTag: Record<Extract<QueryNames, string>, Index<ID, T>>;
    compositeKeySeparator: string;
}>;
export {};
