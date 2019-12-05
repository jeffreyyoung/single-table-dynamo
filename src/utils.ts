import { SingleTableDocument } from './SingleTableDocument';

export type KeyOfStr<T> = Extract<keyof T, string>;
/**
 *
 * Each Local Secondary Index is named lsi1, lsi2, ... or lsi3
 * This function should be used when executing a query with a LSI
 *
 * @param i
 */
export function getLSIName(which: number): KeyOfStr<SingleTableDocument> {
  return `__lsi${which}` as any;
}

export function getLSISortKeyAttribute(
  which: number
): KeyOfStr<SingleTableDocument> {
  return `__lsi${which}` as any;
}

export function getGSIName(which: number): KeyOfStr<SingleTableDocument> {
  return `__gsi${which}` as any;
}

export function getGSIAttributeName(
  which: number,
  type: 'Sort' | 'Hash'
): KeyOfStr<SingleTableDocument> {
  return `__gsi${type}${which}` as any;
}


export const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));