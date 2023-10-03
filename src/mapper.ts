import {
  DeleteCommandInput,
  DeleteCommandOutput,
  DynamoDBDocumentClient as DocumentClient,
  GetCommandInput,
  GetCommandOutput,
  PutCommandInput,
  PutCommandOutput,
} from "@aws-sdk/lib-dynamodb";
import { GetRequest } from "./batch-get";
import { Repository } from "./repository";
import { UnwrapPromise } from "./utils/UnwrapPromise";
import { removeUndefined } from "./utils/removeUndefined";
import { takeWhile } from "./utils/takeWhile";
import { STDError } from "./utils/errors";
import { z } from "zod";
import { hasProperty } from "./utils/hasProperty";

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
  sparse?: boolean;
  shouldWriteIndex?: (src: T) => boolean;
};

export type RawResult = GetRequest & {
  Item: Record<string, any> | null;
};

export type onHooks = {
  get?: (
    args: Parameters<Repository["get"]>,
    returned: UnwrapPromise<ReturnType<Repository["get"]>>,
    raw: RawResult
  ) => any;
  put?: (
    args: Parameters<Repository["put"]>,
    returned: UnwrapPromise<ReturnType<Repository["put"]>>,
    keyInfo: RawResult
  ) => any;
  delete?: (
    args: Parameters<Repository["delete"]>,
    returned: UnwrapPromise<ReturnType<Repository["delete"]>>,
    keyInfo: GetRequest
  ) => any;
  mutate?: (
    args: Parameters<Repository["mutate"]>,
    returned: UnwrapPromise<ReturnType<Repository["mutate"]>>,
    keyInfo: RawResult
  ) => any;
  queryStart?: (args: any) => any;
  query?: (args: any, results: RawResult[]) => any;
};

type GetDocArg = GetCommandInput;
type GetDocResult = GetCommandOutput;

export type DataLoader = {
  load: (key: GetDocArg) => Promise<GetDocResult>;
  prime: (key: GetDocArg, value: GetDocResult) => void;
  clear: (key: GetDocArg) => DataLoader;
};

export type identity<T> = T;
export type flatten<T extends object> = identity<{ [k in keyof T]: T[k] }>;

export type noNeverKeys<T extends object> = {
  [k in keyof T]: [T[k]] extends [never] ? never : k;
}[keyof T];

export type noNever<T extends object> = identity<{
  [k in noNeverKeys<T>]: k extends keyof T ? T[k] : never;
}>;

export type RepositoryArgs<
  Schema extends z.AnyZodObject = z.AnyZodObject,
  T = z.infer<Schema>,
  PrimaryKeyField extends IndexField<T> = any,
  IndexTag extends string = "",
  SecondaryIndexTag extends string = string
> = {
  /**
   * Zod schema for the object
   */
  schema: Schema;
  /**
   * The name of the table in dynamodb
   */
  tableName: string;
  /**
   * The name of the type of object being stored
   * This is used to prefix the primary key
   */
  typeName: string;
  on?: onHooks;
  dataLoader?: DataLoader;
  documentClient: DocumentClient;
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
  Output extends object = z.infer<Schema>,
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
    const seen = new Map();
    if (this.args.secondaryIndexes) {
      Object.entries(this.args.secondaryIndexes).forEach(([key, idx]) => {
        const index = idx as any as SecondaryIndex<any>;
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
      return id; // todo update this?
    } catch (error: any) {
      throw new STDError({
        cause: error,
        message: `Unable to parse ${this.args.typeName} id`,
        name: "single-table-IdValidationError",
        meta: {
          objectType: this.args.typeName,
          itemId: id,
        },
      });
    }
  }

  pickedParse<Mask extends keyof Output>(
    obj: any,
    fields: Mask[],
    type: "input" | "output"
  ) {
    try {
      const mask: any = {};
      fields.forEach((field) => (mask[field] = true));
      return this.args.schema.pick(mask).parse(obj);
    } catch (error: any) {
      throw new STDError({
        cause: error,
        name:
          type === "input"
            ? "single-table-InputValidationError"
            : "single-table-OutputValidationError",
        message: `Unable to picked parse ${this.args.typeName} ${type}`,
        meta: {
          objectType: this.args.typeName,
          fields,
          obj,
        },
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
      throw new STDError({
        cause: error,
        name:
          type === "input"
            ? "single-table-InputValidationError"
            : "single-table-OutputValidationError",
        message: `Unable to partially parse ${this.args.typeName} ${type}`,
        meta: {
          objectType: this.args.typeName,
          fields,
          obj,
        },
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
      throw new STDError({
        cause: error,
        name:
          type === "input"
            ? "single-table-InputValidationError"
            : "single-table-OutputValidationError",
        message: `Unable to parse ${this.args.typeName} ${type}`,
        meta: {
          objectType: this.args.typeName,
          obj,
        },
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

  /**
   * Adds the index keys to the given `thing` and returns a new object with the keys added.
   *
   * @param {Output} thing - The object to add the index keys to.
   * @param {Object} [options={}] - An optional object with the following properties:
   * @param {boolean} [options.assert=false] - If `true`, the `thing` object will be parsed to ensure it conforms to the schema before adding the index keys.
   *
   * @returns {Output & Record<string, string>} A new object with the index keys added.
   */
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

  getIndexKey<IdOrT extends object>(
    thing: Partial<IdOrT>,
    index: IndexBase<IdOrT>,
    options: { partial?: boolean; debugInfo?: object } = {}
  ): Record<string, string> {
    if (!options.partial && !shouldWriteIndex(thing as IdOrT, index)) {
      return {};
    }
    const numPkFields = index.partitionKeyFieldCount || 1;

    const pkFields = index.fields.slice(0, numPkFields);
    let skFields = index.fields.slice(numPkFields);

    if (options.partial || isSparseIndex(index)) {
      skFields = takeWhile(skFields, (f) => !hasProperty(thing, f));
    }

    [...pkFields, ...skFields].forEach((f) => {
      if (!hasProperty(thing, f)) {
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

  dataLoaderClear(id: Id) {
    if (this.args.dataLoader) {
      const key = this.getGetDocArg(id);
      this.args.dataLoader.clear(key);
    }
  }

  dataLoaderPrime(id: Id, rawResult: object | null) {
    if (this.args.dataLoader) {
      const key = this.getGetDocArg(id);
      const res = this.getGetDocResult(id, rawResult);
      this.args.dataLoader.clear(key).prime(key, res);
    }
  }

  private getGetDocArg(thing: Output | Id): GetDocArg {
    return {
      TableName: this.args.tableName,
      Key: this.getKey(thing),
    };
  }

  private getGetDocResult(id: Id, rawResult: object | null): GetDocResult {
    return {
      $metadata: {} as any,
      Item: rawResult || undefined,
    };
  }

  getHookKeyInfo(thing: Output | Id): GetRequest {
    return {
      TableName: this.args.tableName,
      Key: this.getKey(thing),
    };
  }

  getHookResultInfo(id: Id, rawResult: object | null): RawResult {
    return {
      ...this.getHookKeyInfo(id),
      Item: rawResult,
    };
  }
}

function shouldWriteIndex<T extends object>(obj: T, index: IndexBase<T>) {
  if (isSecondaryIndex(index) && index.shouldWriteIndex) {
    return index.shouldWriteIndex(obj);
  } else if (isSecondaryIndex(index) && index.sparse) {
    return index.fields.every((f) => hasProperty(obj, f));
  } else {
    return true;
  }
}

function isSparseIndex(index: IndexBase<any, any>) {
  return Boolean((index as any)?.sparse);
}

function isSecondaryIndex<T = object>(
  index: IndexBase<T>
): index is IndexBase<T> & SecondaryIndex<T> {
  return Boolean((index as any as SecondaryIndex<T>).indexName);
}

export function ifSecondaryIndexGetName(
  index: IndexBase<any, any>
): string | undefined {
  return (index as any)?.indexName;
}
