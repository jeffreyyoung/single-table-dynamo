import { SingleTableDocument } from './SingleTableDocument';
import {
  KeyOfStr,
  getLSISortKeyAttribute,
  getGSIAttributeName,
  getGSIName,
  getLSIName,
} from './utils';
import { getDefaultTableName } from './createTable';

export type PropList<T> = KeyOfStr<T>[];
export type PropList2<A, B> = (KeyOfStr<A> | KeyOfStr<B>)[];
type BaseIndex<ID, T> = {
  hashKeyFields: PropList2<ID, T>;
  hashKeyDescriptor: string;
  hashKeyAttribute: keyof SingleTableDocument<T>;

  sortKeyFields: PropList2<ID, T>;
  sortKeyDescriptor: string;
  sortKeyAttribute: keyof SingleTableDocument<T>;

  tag?: string;
};
export type Index<ID, T> = (
  | { type: 'primaryIndex' }
  | {
      type: 'localSecondaryIndex' | 'globalSecondaryIndex';
      indexName: string;
    }) &
  BaseIndex<ID, T>;

export function getPrimaryIndex<ID, T>(
  config: ConfigArgs<ID, T>,
  tag: string = ''
): Index<ID, T> {
  return {
    hashKeyFields: config.hashKeyFields,
    hashKeyDescriptor: config.objectName,
    hashKeyAttribute: 'hashKey',

    sortKeyFields: config.sortKeyFields || [],
    sortKeyDescriptor: config.objectName,
    sortKeyAttribute: 'sortKey',

    type: 'primaryIndex',

    tag,
  };
}

function isPrimaryQueryArg(thing: any): thing is PrimaryQueryArg {
  return thing && thing.isPrimary;
}

function isLSIQueryArg<T>(thing: any): thing is LSIQueryArg<T> {
  return thing && thing.sortKeyFields && !thing.hashKeyFields;
}

function isGSIQueryArg<T>(thing: any): thing is GSIQueryArg<T> {
  return thing && thing.sortKeyFields && thing.hashKeyFields;
}

export function convertQueryArgToIndex<ID, T>(
  queryName: string,
  config: ConfigArgs<ID, T>
): Index<ID, T> {
  let index = (config.queries || {})[queryName];
  if (isPrimaryQueryArg(index)) {
    return getPrimaryIndex(config, queryName);
  } else if (isLSIQueryArg(index)) {
    return getLSIIndex<ID, T>(queryName, index, config);
  } else if (isGSIQueryArg(index)) {
    return getGSIIndex<ID, T>(queryName, index, config);
  } else {
    throw { message: `${queryName} is not valid` };
  }
}
export function getLSIIndex<ID, T>(
  queryName: string,
  i: LSIQueryArg<T>,
  config: ConfigArgs<ID, T>
): Index<ID, T> {
  return {
    hashKeyFields: config.hashKeyFields,
    hashKeyDescriptor: config.objectName,
    hashKeyAttribute: 'hashKey',

    sortKeyFields: i.sortKeyFields,
    sortKeyDescriptor: queryName,
    sortKeyAttribute: getLSISortKeyAttribute<T>(
      i.which
    ) as keyof SingleTableDocument<T>,

    indexName: getLSIName(i.which),

    type: 'localSecondaryIndex',

    tag: queryName,
  };
}

export function getGSIIndex<ID, T>(
  queryName: string,
  i: GSIQueryArg<T>,
  config: ConfigArgs<ID, T>
): Index<ID, T> {
  return {
    hashKeyFields: i.hashKeyFields,
    hashKeyDescriptor: config.objectName + '-' + queryName,
    hashKeyAttribute: getGSIAttributeName(
      i.which,
      'Hash'
    ) as keyof SingleTableDocument<T>,

    sortKeyFields: i.sortKeyFields,
    sortKeyDescriptor: queryName,
    sortKeyAttribute: getGSIAttributeName(
      i.which,
      'Sort'
    ) as keyof SingleTableDocument<T>,

    indexName: getGSIName(i.which),

    type: 'globalSecondaryIndex',

    tag: queryName,
  };
}

type PrimaryQueryArg = {
  isPrimary: true;
};

type LSIQueryArg<T> = {
  sortKeyFields: PropList<T>;
  type?: 'localSecondaryIndex';
  which: 0 | 1 | 2 | 3 | 4;
};

type GSIQueryArg<T> = {
  sortKeyFields: PropList<T>;
  hashKeyFields: PropList<T>;
  type?: 'globalSeconaryIndex';
  which:
    | 0
    | 1
    | 2
    | 3
    | 4
    | 5
    | 6
    | 7
    | 8
    | 9
    | 10
    | 11
    | 12
    | 13
    | 14
    | 15
    | 16
    | 17
    | 18
    | 19;
};

export type ConfigArgs<ID, T, QueryNames = string> = {
  tableName?: string;
  objectName: string;
  hashKeyFields: PropList<ID>;
  sortKeyFields?: PropList<ID>;
  compositeKeySeparator?: '#';
  queries?: Record<
    Extract<QueryNames, string>,
    GSIQueryArg<T> | LSIQueryArg<T> | PrimaryQueryArg
  >;
};
type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export function getConfig<ID, T>(
  argsIn: PartialBy<ConfigArgs<ID, T>, 'queries'>
): Config<ID, T> {
  const args: ConfigArgs<ID, T> = Object.assign({ queries: {} }, argsIn);
  let indexes = [
    getPrimaryIndex(args),
    ...(args.queries
      ? Object.keys(args.queries).map(queryName =>
          convertQueryArgToIndex(queryName, args)
        )
      : []),
  ];

  let indexesByTag = indexes.reduce((prev, index) => {
    return {
      ...prev,
      [index.tag as string]: index,
    };
  }, {});

  return Object.assign(
    {
      tableName: args.tableName || getDefaultTableName(),
      compositeKeySeparator: args.compositeKeySeparator || '#',
    },
    {
      objectName: args.objectName,
      primaryIndex: indexes[0],
      indexes,
      indexesByTag,
    }
  );
}

export type Config<ID, T, QueryNames = string> = Readonly<{
  tableName: string;
  objectName: string;
  primaryIndex: Index<ID, T>;
  indexes: Index<ID, T>[];
  indexesByTag: Record<Extract<QueryNames, string>, Index<ID, T>>;
  compositeKeySeparator: string;
}>;
