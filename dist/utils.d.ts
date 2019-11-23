import { SingleTableDocument } from './SingleTableDocument';
export declare type KeyOfStr<T> = Extract<keyof T, string>;
/**
 *
 * Each Local Secondary Index is named lsi1, lsi2, ... or lsi3
 * This function should be used when executing a query with a LSI
 *
 * @param i
 */
export declare function getLSIName<T>(which: number): KeyOfStr<SingleTableDocument<T>>;
export declare function getLSISortKeyAttribute<T>(which: number): KeyOfStr<SingleTableDocument<T>>;
export declare function getGSIName<T>(which: number): KeyOfStr<SingleTableDocument<T>>;
export declare function getGSIAttributeName<T>(which: number, type: 'Sort' | 'Hash'): KeyOfStr<SingleTableDocument<T>>;
