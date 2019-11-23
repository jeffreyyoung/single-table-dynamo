import { SingleTableDocument } from './SingleTableDocument';

export type KeyOfStr<T> = Extract<keyof T, string>;
/**
 *
 * Each Local Secondary Index is named lsi1, lsi2, ... or lsi3
 * This function should be used when executing a query with a LSI
 *
 * @param i
 */
export function getLSIName<T>(which: number): KeyOfStr<SingleTableDocument<T>> {
  return `lsi${which}` as any;
}

export function getLSISortKeyAttribute<T>(
  which: number
): KeyOfStr<SingleTableDocument<T>> {
  return `lsi${which}` as any;
}

export function getGSIName<T>(which: number): KeyOfStr<SingleTableDocument<T>> {
  return `gsi${which}` as any;
}

export function getGSIAttributeName<T>(
  which: number,
  type: 'Sort' | 'Hash'
): KeyOfStr<SingleTableDocument<T>> {
  return `gsi${type}${which}` as any;
}
