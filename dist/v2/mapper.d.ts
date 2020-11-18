export declare type KeysOfType<T, TProp> = {
    [P in keyof T]: T[P] extends TProp ? P : never;
}[keyof T];
declare enum IndexType {
    Primary = "Primary",
    Secondary = "Secondary"
}
declare type PrimaryIndex = {
    type?: IndexType.Primary;
    tag: string;
};
declare type SecondaryIndex = {
    type?: IndexType.Secondary;
    indexName: string;
    tag: string;
};
export declare type IndexBase = PrimaryIndex | SecondaryIndex;
export declare type Index<Src> = {
    partitionKey: KeysOfType<Src, string>;
    sortKey: KeysOfType<Src, string>;
} & IndexBase;
export declare type CompositeIndex<Src> = {
    partitionKey: string;
    sortKey: string;
    fields: (KeysOfType<Src, string> | NonStringField<Src>)[];
} & IndexBase;
export declare type SingleTableIndex<Src> = Index<Src> | CompositeIndex<Src>;
interface NonStringField<Src> {
    toString: (s: Src) => string;
    fields: Extract<keyof Src, string>[];
}
export declare type MapperArgs<Src> = {
    typeName: string;
    indexFieldSeparator?: string;
    indexes: (SingleTableIndex<Src>)[];
};
export declare function isPrimaryIndex(thing: any): thing is PrimaryIndex;
/**
 * The mapper is what has the responsibility of decorating
 * a
 * @param args
 */
export declare class Mapper<Src> {
    args: MapperArgs<Src>;
    constructor(args: MapperArgs<Src>);
    /**
     * Takes an object to be saved to ddb,
     * and adds any computed index fields to it
     * @param src
     */
    decorateWithIndexedFields(src: Src): Src;
    stringifyField(src: Partial<Src>, f: CompositeIndex<Src>['fields'][number]): any;
    _isCompositeIndex(index: MapperArgs<Src>['indexes'][number]): index is CompositeIndex<Src>;
    _computeCompositePrimaryKey(src: Partial<Src>, primaryField: CompositeIndex<Src>['fields'][number]): string;
    _computeCompositeSortKey(src: Partial<Src>, sortKeyFields: CompositeIndex<Src>['fields']): string;
    _isInSrc(src: Partial<Src>, indexField: CompositeIndex<Src>['fields'][number]): boolean;
    /**
     * Returns the key/values of an index
     * @param src
     * @param typeName
     * @param index
     */
    computeIndexFields(src: Partial<Src>, index: MapperArgs<Src>['indexes'][number]): {};
}
export {};
