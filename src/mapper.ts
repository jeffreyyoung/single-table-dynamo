import { DocumentClient } from "aws-sdk/clients/dynamodb";
import { GetRequest } from "./batch-get";
import { Repository } from "./repository";
import { UnwrapPromise } from "./utils/UnwrapPromise";
import { removeUndefined } from "./utils/removeUndefined";
import { takeWhile } from "./utils/takeWhile";
import { createSTDError } from "./utils/errors";
import { z } from "zod";

export type IndexField<T> = Extract<keyof T, string>;

export type IndexBase<T, Field extends IndexField<T> = any> = {
  /**
   * The fields to be indexed.  The first <partitionKeyFieldCount ?? 1> are used for the partition key
   * while the rest are used for the sort key. To query this index all partitionKeys must be provided
   */
  fields: Field[];
  pk: string;
  sk: string;
  /**
   * By default, the first field in the fields array will be used as the partition key
   * Setting partitionKeyFieldCount=2 will result in the first 2 fields being used as
   * partitionKeyFields
   */
  partitionKeyFieldCount?: number;
};

type SecondaryIndex<T> = {
  indexName: string;
  onlyWriteWhenAllFieldsPresent?: boolean;
  shouldWriteIndex?: (src: T) => boolean;
};

export type onHooks = {
  get?: (
    args: Parameters<Repository["get"]>,
    returned: UnwrapPromise<ReturnType<Repository["get"]>>,
    keyInfo: GetRequest
  ) => any;
  dangerouslyUpdate?: (
    args: Parameters<Repository["dangerouslyUpdate"]>,
    returned: UnwrapPromise<ReturnType<Repository["dangerouslyUpdate"]>>,
    keyInfo: GetRequest
  ) => any;
  put?: (
    args: Parameters<Repository["put"]>,
    returned: UnwrapPromise<ReturnType<Repository["put"]>>,
    keyInfo: GetRequest
  ) => any;
  delete?: (
    args: Parameters<Repository["delete"]>,
    returned: UnwrapPromise<ReturnType<Repository["delete"]>>,
    keyInfo: GetRequest
  ) => any;
  queryStart?: (args: any) => any;
  query?: (args: any, results: any) => any;
};

export type identity<T> = T;
export type flatten<T extends object> = identity<{ [k in keyof T]: T[k] }>;

export type noNeverKeys<T extends any> = {
  [k in keyof T]: [T[k]] extends [never] ? never : k;
}[keyof T];

export type noNever<T extends any> = identity<{
  [k in noNeverKeys<T>]: k extends keyof T ? T[k] : never;
}>;

export type ZodesqueSchema<Ouput = unknown, Input = unknown> = z.AnyZodObject;

export type RepositoryArgs<
  Schema extends z.AnyZodObject = z.AnyZodObject,
  T = z.infer<Schema>,
  PrimaryKeyField extends IndexField<T> = any,
  IndexTag extends string = "",
  SecondaryIndexTag extends string = string
> = {
  schema: Schema;
  tableName: string;
  typeName: string;
  getDocument?: (
    args: Parameters<DocumentClient["get"]>[0]
  ) => ReturnType<ReturnType<DocumentClient["get"]>["promise"]>;
  on?: onHooks;
  primaryIndex: IndexBase<T, PrimaryKeyField> & {
    tag?: IndexTag;
  };
  /**
   * Called when zod throws a validation error after retrieving an object
   * from the database.  In migrate, an attempt should be made to fix the
   * error.  The returned value from migrate will be validated against
   * the object schema
   */
  migrate?: (rawObjectRetrievedFromDb: unknown) => Promise<T> | T;
  secondaryIndexes?: Record<
    SecondaryIndexTag,
    IndexBase<T> & SecondaryIndex<T>
  >;
};

export class Mapper<
  Schema extends z.AnyZodObject = z.AnyZodObject,
  Output = z.infer<Schema>,
  PrimaryKeyField extends IndexField<Output> = any,
  IndexTag extends string = string,
  SecondaryIndexTag extends string = string,
  Id = Pick<Output, PrimaryKeyField>
> {
  public args: RepositoryArgs<
    Schema,
    Output,
    PrimaryKeyField,
    IndexTag,
    SecondaryIndexTag
  >;

  constructor(
    args: RepositoryArgs<
      Schema,
      Output,
      PrimaryKeyField,
      IndexTag,
      SecondaryIndexTag
    >
  ) {
    this.args = args;
    //validate args
    this.validateIndexes();
  }

  validateIndexes() {
    let seen = new Map();
    if (this.args.secondaryIndexes) {
      Object.entries(this.args.secondaryIndexes).forEach(([key, idx]) => {
        let index = idx as any as SecondaryIndex<any>;
        if (seen.has(index.indexName)) {
          throw new Error(
            `SingleTableIndexValidationError: indexes ${key} and ${seen.get(
              index.indexName
            )} both write to the same index ${
              index.indexName
            }.  Each secondary index should be associated with a unique index.`
          );
        }
        seen.set(index.indexName, key);
      });
    }
  }

  parseId(id: Id): Id {
    try {
      return id;
    } catch (error: any) {
      throw createSTDError({
        cause: error,
        message: `Unable to parse ${this.args.typeName} id`,
        name: "single-table-IdValidationError",
      });
    }
    return id;
  }

  pickedParse<Mask extends keyof Output>(
    obj: any,
    fields: Mask[],
    type: "input" | "output"
  ) {
    try {
      let mask: any = {};
      fields.forEach((field) => (mask[field] = true));
      return this.args.schema.pick(mask).parse(obj);
    } catch (error: any) {
      throw createSTDError({
        cause: error,
        name:
          type === "input"
            ? "single-table-InputValidationError"
            : "single-table-OutputValidationError",
        message: `Unable to picked parse ${this.args.typeName} ${type}`,
      });
    }
  }

  partialParse(
    obj: any,
    type: "input" = "input",
    fields?: (keyof Output)[]
  ): Partial<Output> {
    try {
      const parsedPartial = this.args.schema.partial().parse(obj);
      //@ts-ignore
      return removeUndefined(parsedPartial);
    } catch (error: any) {
      throw createSTDError({
        cause: error,
        name:
          type === "input"
            ? "single-table-InputValidationError"
            : "single-table-OutputValidationError",
        message: `Unable to partially parse ${this.args.typeName} ${type}`,
      });
    }
  }

  /**
   *
   * @param obj
   * @returns
   */
  parse(obj: any, type: "input" | "output" = "input"): Output {
    try {
      // @ts-ignore
      return this.args.schema.parse(obj);
    } catch (error: any) {
      throw createSTDError({
        cause: error,
        name:
          type === "input"
            ? "single-table-InputValidationError"
            : "single-table-OutputValidationError",
        message: `Unable to parse ${this.args.typeName} ${type}`,
      });
    }
  }

  getKey(id: Id | Output) {
    return this.getIndexKey(id as any, this.args.primaryIndex);
  }

  /**
   * This should be renamed to getIndexFields
   * @param thing
   * @returns
   */
  getIndexKeys(thing: Output, { assert = true } = {}) {
    if (assert) {
      thing = this.parse(thing, "input");
    }
    return this.getIndexes()
      .map((i) => this.getIndexKey(thing, i))
      .reduce((prev = {}, cur) => ({ ...prev, ...cur }), {});
  }

  decorateWithKeys(
    thing: Output,
    options: { assert?: boolean } = {}
  ): Output & Record<string, string> {
    const keys = this.getIndexKeys(thing, { assert: !!options.assert });
    return Object.assign({}, thing, keys);
  }

  /**
   * Only writes the index fields for which every index.fields field is present
   * @param thing
   * @returns
   */
  partialDecorateWithKeys<T1 extends Partial<Output>>(
    thing: T1
  ): T1 & Record<string, string> {
    const keys = this.getIndexes()
      .filter((i) => i.fields.every((requiredField) => requiredField in thing))
      .map((i) => this.getIndexKey(thing, i))
      .reduce((prev = {}, cur) => ({ ...prev, ...cur }), {});
    return Object.assign({}, thing, keys);
  }

  getIndexes() {
    return [
      this.args.primaryIndex,
      ...Object.values(this.args.secondaryIndexes || {}),
    ] as IndexBase<Output>[];
  }

  getIndexKey<IdOrT>(
    thing: Partial<IdOrT>,
    index: IndexBase<IdOrT>,
    options: { partial?: boolean; debugInfo?: any } = {}
  ): Record<string, string> {
    if (!options.partial && !shouldWriteIndex(thing as IdOrT, index)) {
      return {};
    }
    const numPkFields = index.partitionKeyFieldCount || 1;

    const pkFields = index.fields.slice(0, numPkFields);
    let skFields = index.fields.slice(numPkFields);

    if (options.partial || isSparseIndex(index)) {
      skFields = takeWhile(skFields, (f) => !Object(thing).hasOwnProperty(f));
    }

    [...pkFields, ...skFields].forEach((f) => {
      if (!Object(thing).hasOwnProperty(f)) {
        throw new Error(
          `To query index (${index.pk}, ${
            index.sk
          }), field: ${f} is required, recieved ${JSON.stringify(thing)}`
        );
      }
    });

    function stringifyField(fieldName: string) {
      return thing[fieldName as keyof IdOrT];
    }

    return {
      [index.pk]: [this.args.typeName, ...pkFields.map(stringifyField)].join(
        "#"
      ),
      [index.sk]: [this.args.typeName, ...skFields.map(stringifyField)].join(
        "#"
      ),
    };
  }
}

function shouldWriteIndex<T>(obj: T, index: IndexBase<T>) {
  if (isSecondaryIndex(index) && index.shouldWriteIndex) {
    return index.shouldWriteIndex(obj);
  } else if (isSecondaryIndex(index) && index.onlyWriteWhenAllFieldsPresent) {
    return index.fields.every((f) => Object(obj).hasOwnProperty(f));
  } else {
    return true;
  }
}

function isSparseIndex(index: IndexBase<any, any>) {
  return Boolean((index as any)?.sparse);
}

function isSecondaryIndex<T = any>(
  index: IndexBase<T>
): index is IndexBase<T> & SecondaryIndex<T> {
  return Boolean((index as any as SecondaryIndex<T>).indexName);
}

export function ifSecondaryIndexGetName(
  index: IndexBase<any, any>
): string | undefined {
  return (index as any)?.indexName;
}
