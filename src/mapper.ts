import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import { GetRequest } from 'batch-get';
import { Repository } from 'repository';
import { mask, partial, Struct } from 'superstruct';
import { StructSchema } from 'superstruct/lib/utils';
import { UnwrapPromise } from './utils/UnwrapPromise';
import { removeUndefined } from './utils/removeUndefined';
import { takeWhile } from './utils/takeWhile';

export type IndexField<T> = Extract<keyof T, string>;

export type IndexBase<T, Field extends IndexField<T> = any> = {
  fields: Field[];
  pk: string;
  sk: string;
  stringifyField?: Partial<Record<Field, (field: Field, obj: T) => string>>;
};

type SecondaryIndex<T> = {
  indexName: string
  onlyWriteWhenAllFieldsPresent?: boolean
  shouldWriteIndex?: (src: T) => boolean
}

export type onHooks<T, R extends Repository> = {
  get?: (args: Parameters<Repository['get']>, returned: UnwrapPromise<ReturnType<Repository['get']>>, keyInfo: GetRequest) => any,
  updateUnsafe?: (args: Parameters<Repository['updateUnsafe']>, returned: UnwrapPromise<ReturnType<Repository['updateUnsafe']>>, keyInfo: GetRequest) => any,
  put?: (args: Parameters<Repository['put']>, returned: UnwrapPromise<ReturnType<Repository['put']>>, keyInfo: GetRequest) => any,
  delete?: (args: Parameters<Repository['delete']>, returned: UnwrapPromise<ReturnType<Repository['delete']>>, keyInfo: GetRequest) => any,
  query?: (results: { result: T, keyInfo: GetRequest }[]) => any
}

export type RepositoryArgs<
  T = Record<string, any>,
  PrimaryKeyField extends IndexField<T> = any,
  IndexTag extends string = '',
  SecondaryIndexTag extends string = string,
> = {
  schema: Struct<T, StructSchema<T>>;
  tableName: string;
  typeName: string;
  getDocument?: (args: Parameters<DocumentClient['get']>[0]) => ReturnType<ReturnType<DocumentClient['get']>['promise']>
  on?: onHooks<T, Repository>,
  primaryIndex: IndexBase<T, PrimaryKeyField> & {
    tag?: IndexTag;
  };
  secondaryIndexes?: Record<
    SecondaryIndexTag,
    IndexBase<T> & SecondaryIndex<T>
  >;
};

export class Mapper<
  T = any,
  PrimaryKeyField extends IndexField<T> = any,
  IndexTag extends string = string,
  SecondaryIndexTag extends string = string,
  Id = Pick<T, PrimaryKeyField>
> {
  public args: RepositoryArgs<T, PrimaryKeyField, IndexTag, SecondaryIndexTag>;

  constructor(
    args: RepositoryArgs<T, PrimaryKeyField, IndexTag, SecondaryIndexTag>
  ) {
    this.args = args;
  }

  partialAssert(obj: Partial<T>): Partial<T> {
    return removeUndefined(mask(obj, partial(this.args.schema as any)) as any);
  }

  assert(obj: T): T {
    return mask(obj, this.args.schema);
  }

  getKey(id: Id | T) {
    return this.getIndexKey(id as any, this.args.primaryIndex);
  }

  decorateWithKeys(thing: T, options: {assert?: boolean} = {}): T & Record<string, string> {
    if (options.assert) {
      this.assert(thing);
    }
    const indexes = [
      this.args.primaryIndex,
      ...Object.values(this.args.secondaryIndexes || {}),
    ] as IndexBase<T>[];
    const keys = indexes
      .map(i => this.getIndexKey(thing, i))
      .reduce((prev = {}, cur) => ({ ...prev, ...cur }));
    return Object.assign({}, thing, keys);
  }

  getIndexKey<IdOrT>(
    thing: Partial<IdOrT>,
    index: IndexBase<IdOrT>,
    options: { partial?: boolean, debugInfo?: any } = {}
  ): Record<string, string> {
    if (!options.partial && !shouldWriteIndex(thing as IdOrT, index)) {
      return {};
    }
    const pkFields = index.fields.slice(0, 1);
    let skFields = index.fields.slice(1);

    if (options.partial || isSparseIndex(index)) {

      skFields = takeWhile(skFields, f => !Object(thing).hasOwnProperty(f));
    }

    [...pkFields, ...skFields].forEach(f => {
      if (!Object(thing).hasOwnProperty(f)) {
        throw new Error(
          `To query index: ${JSON.stringify(
            index
          )}, field: ${f} is required, recieved ${JSON.stringify(thing)}, debugInfo: ${JSON.stringify(options?.debugInfo || {})}`
        );
      }
    });

    function stringifyField(fieldName: string) {
      const stringify = index?.stringifyField?.[fieldName];
      if (stringify) {
        return stringify(fieldName, thing as IdOrT);
      } else {
        return thing[fieldName as any];
      }
    }

    return {
      [index.pk]: [this.args.typeName, ...pkFields.map(stringifyField)].join(
        '#'
      ),
      [index.sk]: [this.args.typeName, ...skFields.map(stringifyField)].join(
        '#'
      ),
    };
  }
}

function shouldWriteIndex<T>(obj: T, index: IndexBase<T>) {
  if (isSecondaryIndex(index) && index.shouldWriteIndex) {
    return index.shouldWriteIndex(obj);
  } else if (isSecondaryIndex(index) && index.onlyWriteWhenAllFieldsPresent) {
    return index.fields.every(f => Object(obj).hasOwnProperty(f))
  } else {
    return true;
  }
}

function isSparseIndex(index: IndexBase<any, any>) {
  return Boolean((index as any)?.sparse);
}

function isSecondaryIndex<T = any>(index: IndexBase<T>): index is (IndexBase<T> & SecondaryIndex<T>) {
  return Boolean((index as any as SecondaryIndex<T>).indexName)
}

export function ifSecondaryIndexGetName(
  index: IndexBase<any, any>
): string | undefined {
  return (index as any)?.indexName;
}
