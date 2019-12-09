import { SingleTableDocument } from './SingleTableDocument';
export declare type KeyOfStr<T> = Extract<keyof T, string>;
/**
 *
 * Each Local Secondary Index is named lsi1, lsi2, ... or lsi3
 * This function should be used when executing a query with a LSI
 *
 * @param i
 */
export declare function getLSIName(which: number): KeyOfStr<SingleTableDocument>;
export declare function getLSISortKeyAttribute(which: number): KeyOfStr<SingleTableDocument>;
export declare function getGSIName(which: number): KeyOfStr<SingleTableDocument>;
export declare function getGSIAttributeName(which: number, type: 'Sort' | 'Hash'): KeyOfStr<SingleTableDocument>;
export declare const wait: (ms: number) => Promise<unknown>;
