import { getDocClient } from './AWS';
import { SingleTableDocument } from './SingleTableDocument';
import { ConfigArgs, Index, Config, getConfig } from './config';
import { KeyOfStr } from './utils';
import { DocumentClient } from 'aws-sdk/clients/dynamodb';

export type WhereClause<T = any, QueryNames = string> = {
  sort?: 'asc' | 'desc';
  args: Partial<T>;
  index?: QueryNames;
  sortBy?: KeyOfStr<T>;
  cursor?: Record<string, any>;
  limit?: number;
};

export type QueryResult<T> = {
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
export function getCompositeKeyValue<ID, T>(
  thing: T,
  properties: (keyof T | keyof ID)[],
  descriptor: string,
  separator: string,
  shouldPadNumbersInIndexes: boolean
) {
  return [
    descriptor,
    ...properties.map(k =>
      dynamoProperty(k as string, thing[k as keyof T], shouldPadNumbersInIndexes)
    ),
  ].join(separator);
}

function padDecimalNumber(value: number) {
  let [before,after] = String(value).split('.');

  return [(before || '').padStart(18, '0'), (after || '').padEnd(2, '0')].join('.')
}

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
export function dynamoProperty(key: string, value: any, shouldPadNumbersInIndexes: boolean) {
  let stringified = String(value);
  if (typeof value === 'number' && value >= 0 && shouldPadNumbersInIndexes) {
    stringified = padDecimalNumber(value as number);
  }
  return `${key}-${stringified}`;
}

export function getSortkeyForBeginsWithQuery<ID, T>(
  thing: Partial<T>,
  indexFields: (keyof T | keyof ID)[],
  descriptor: string,
  compositeKeySeparator: string,
  shouldPadNumbersInIndexes: boolean
) {
  let fields = [descriptor];
  for (let i = 0; i < indexFields.length; i++) {
    let k = indexFields[i];
    if (k in thing) {
      fields.push(dynamoProperty(k as string, String(thing[k as keyof T]), shouldPadNumbersInIndexes));
    } else {
      break;
    }
  }
  return fields.join(compositeKeySeparator);
}

export function findIndexForQuery<ID, T, QueryNames>(
  where: WhereClause<T>,
  config: Config<ID, T, QueryNames>
): Index<ID, T> | null {
  if (where.index) {
    if (config.indexesByTag[(where.index as unknown) as any]) {
      return config.indexesByTag[(where.index as unknown) as any];
    } else {
      throw {
        message: `The index "${
          where.index
        }" does not exist, the following are valid indexes: ${Object.keys(
          config.indexesByTag
        ).join(',')}`,
      };
    }
  }

  let indexes = config.indexes;

  for (let i = 0; i < indexes.length; i++) {
    let index = indexes[i];
    let neededFields = new Set(Object.keys(where.args) as (
      | keyof ID
      | keyof T)[]);

    //for this index to be eligible, we need every hashKey field to be provided in the query
    let queryContainsAllHashKeyFields = index.hashKeyFields.every(k =>
      neededFields.has(k)
    );

    //query contains all hash key fields
    if (queryContainsAllHashKeyFields) {
      index.hashKeyFields.forEach(k => neededFields.delete(k));
      const sortKeyFieldIndex = neededFields.size;
      //ensure that the first n fields of this index are included in the where clause
      index.sortKeyFields
        .slice(0, neededFields.size)
        .forEach(k => neededFields.delete(k));

      //all the specified fields are in the correct place for this index
      if (neededFields.size === 0) {
        //check if this config has a sort and if it's in the right place
        if (where.sortBy) {
          if (index.sortKeyFields.indexOf(where.sortBy) === sortKeyFieldIndex) {
            return index;
          }
        } else {
          return index;
        }
      }
    }
  }
  return null;
}

type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

function getKey<ID, T>(
  id: ID | T,
  i: Index<ID, T>,
  separator: string,
  shouldPadNumbersInIndexes: boolean
): Partial<Omit<SingleTableDocument<T>, 'data'>> {
  return {
    [i.hashKeyAttribute]: getCompositeKeyValue(
      id as any,
      i.hashKeyFields as (keyof ID)[],
      i.hashKeyDescriptor,
      separator,
      shouldPadNumbersInIndexes
    ),
    [i.sortKeyAttribute]: getCompositeKeyValue(
      id as any,
      i.sortKeyFields as (keyof ID)[],
      i.sortKeyDescriptor,
      separator,
      shouldPadNumbersInIndexes
    ),
  };
}

type Queries<T, QueryNames> = Record<
  Extract<QueryNames, string>,
  (where: WhereClause<T>) => Promise<QueryResult<T>>
>;

export type Repository<ID = any, T = any, QueryNames = string> = {
  config: Config<ID, T>;
  getKey: (id: ID) => any;
  get: (id: ID) => Promise<T | null>;
  update: (id: ID, updates: Partial<T>) => Promise<T>;
  overwrite: (thing: T) => Promise<T>;
  put: (thing: T) => Promise<T>;
  delete: (id: ID) => Promise<boolean>;
  formatForDDB: (thing: T) => SingleTableDocument<T>;
  executeQuery: (
    where: WhereClause<T>,
    index: Index<ID, T>
  ) => Promise<QueryResult<T>>;
  getQueryArgs(where: WhereClause<T>, index: Index<ID,T>): DocumentClient.QueryInput 
  query: (where: WhereClause<T>) => Promise<QueryResult<T>>;
  queryOne: (where: WhereClause<T>) => Promise<T | null>;
  findIndexForQuery: (where: WhereClause<T>) => Index<ID, T> | null;
  queries: Queries<T, QueryNames>;
};

//const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export function getRepository<ID, T, QueryNames = string>(
  args: ConfigArgs<ID, T, QueryNames>
): Repository<ID, T, QueryNames> {
  let config = getConfig(args);
  let repo: Repository<ID, T, QueryNames> = {
    get config() {
      return config;
    },
    getKey: (id: ID) => {
      return getKey(id, config.primaryIndex, config.compositeKeySeparator, config.shouldPadNumbersInIndexes);
    },
    get: async (id: ID): Promise<T | null> => {
      let res = await getDocClient()
        .get({
          TableName: config.tableName,
          Key: repo.getKey(id),
        })
        .promise();
      if (!res.Item) {
        return null;
      }
      return (res.Item as any).data;
    },
    update: async (id: ID, thing: Partial<T>): Promise<T> => {
      let old = (await repo.get(id)) as T;
      let updated = { ...old, ...thing };
      return repo.overwrite(updated);
    },
    put: (thing: T): Promise<T> => {
      return repo.overwrite(thing);
    },
    overwrite: async (thing: T): Promise<T> => {
      await getDocClient()
        .put({
          TableName: config.tableName,
          Item: repo.formatForDDB(thing),
        })
        .promise();
      return thing;
    },
    delete: async (id: ID): Promise<boolean> => {
      await getDocClient()
        .delete({
          TableName: config.tableName,
          Key: repo.getKey(id),
        })
        .promise();

      return true;
    },
    getQueryArgs(where: WhereClause<T>, index: Index<ID,T>): DocumentClient.QueryInput {
      const hashKey = getCompositeKeyValue<ID, T>(
        where.args as T,
        index.hashKeyFields,
        index.hashKeyDescriptor,
        config.compositeKeySeparator,
        config.shouldPadNumbersInIndexes
      );
      const sortKey =
        index.sortKeyFields &&
        getSortkeyForBeginsWithQuery<ID, T>(
          where.args,
          index.sortKeyFields,
          index.sortKeyDescriptor,
          config.compositeKeySeparator,
          config.shouldPadNumbersInIndexes
        );

      return {
          TableName: config.tableName,
          ...((index as any).indexName && {
            IndexName: (index as any).indexName,
          }),
          Limit: where.limit || 5,
          ScanIndexForward: where.sort === 'asc',
          KeyConditionExpression: `${index.hashKeyAttribute} = :hKey and begins_with(${index.sortKeyAttribute}, :sKey) `,
          ExpressionAttributeValues: {
            ':hKey': hashKey,
            ':sKey': sortKey,
          },
          ...(where.cursor && {
            ExclusiveStartKey: where.cursor,
          }),
        };
    },
    executeQuery: async (
      where: WhereClause<T>,
      index: Index<ID, T>
    ): Promise<QueryResult<T>> => {
      
      let res = await getDocClient()
        .query(repo.getQueryArgs(where, index))
        .promise();

      let nextWhere: WhereClause<T> | undefined = res &&
        res.LastEvaluatedKey && {
          ...where,
          cursor: (res as any).LastEvaluatedKey,
        };

      return {
        results: (res as any).Items.map((i: SingleTableDocument<T>) => {
          return i.data;
        }),
        nextPageArgs: nextWhere,
      };
    },
    query: async (where: WhereClause<T>): Promise<QueryResult<T>> => {
      let index = findIndexForQuery<ID, T, QueryNames>(where, config);

      if (!index) {
        throw { message: 'there isnt an index configured for this query' };
      }

      return repo.executeQuery(where, index);
    },
    queryOne: async (argsIn: WhereClause<T>): Promise<T | null> => {
      const args = { ...argsIn, limit: 1 };
      const res = await repo.query(args);
      if (res.results.length > 0) {
        return res.results[0];
      } else {
        return null;
      }
    },
    formatForDDB(thing: T) {
      let obj: Partial<SingleTableDocument<T>> = {
        data: thing,
        objectType: config.objectName,
      };

      config.indexes.forEach(i => {
        obj = {
          ...obj,
          ...getKey(thing, i, config.compositeKeySeparator, config.shouldPadNumbersInIndexes),
        };
      });

      return obj as SingleTableDocument<T>;
    },
    findIndexForQuery: (where: WhereClause<T>) => {
      return findIndexForQuery<ID, T, QueryNames>(where, config);
    },
    queries: Object.keys(config.indexesByTag).reduce(
      (obj: any, key: string) => {
        obj[key] = (where: WhereClause<T>) =>
          repo.executeQuery(where, config.indexesByTag[key]);
        return obj;
      },
      {}
    ) as Queries<T, QueryNames>,
  };
  return repo;
}
