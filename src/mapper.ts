import { DocumentClient } from "aws-sdk/clients/dynamodb";
import { GetRequest } from "./batch-get";
import { Repository } from "./repository";
import { UnwrapPromise } from "./utils/UnwrapPromise";
import { removeUndefined } from "./utils/removeUndefined";
import { takeWhile } from "./utils/takeWhile";
import { createSTDDBError } from "./utils/errorHandling";

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
  stringifyField?: Partial<Record<Field, (field: Field, obj: T) => string>>;
};

type SecondaryIndex<T> = {
  indexName: string;
  onlyWriteWhenAllFieldsPresent?: boolean;
  shouldWriteIndex?: (src: T) => boolean;
};

export type onHooks<T, R extends Repository> = {
  get?: (
    args: Parameters<Repository["get"]>,
    returned: UnwrapPromise<ReturnType<Repository["get"]>>,
    keyInfo: GetRequest
  ) => any;
  updateUnsafe?: (
    args: Parameters<Repository["updateUnsafe"]>,
    returned: UnwrapPromise<ReturnType<Repository["updateUnsafe"]>>,
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
  query?: (results: { result: T; keyInfo: GetRequest }[]) => any;
};

export type identity<T> = T;
export type flatten<T extends object> = identity<{ [k in keyof T]: T[k] }>;

export type noNeverKeys<T extends any> = {
  [k in keyof T]: [T[k]] extends [never] ? never : k;
}[keyof T];

export type noNever<T extends any> = identity<{
  [k in noNeverKeys<T>]: k extends keyof T ? T[k] : never;
}>;

export type ZodesqueSchema<TInput = unknown> = {
  parse: (input: any) => TInput;
  partial: () => {
    parse: (input: any) => Partial<TInput>;
  };
  pick(m: any): {
    parse: (input: any) => any;
  };
};

export type RepositoryArgs<
  T = Record<string, any>,
  PrimaryKeyField extends IndexField<T> = any,
  IndexTag extends string = "",
  SecondaryIndexTag extends string = string
> = {
  schema: ZodesqueSchema<T>;
  tableName: string;
  typeName: string;
  getDocument?: (
    args: Parameters<DocumentClient["get"]>[0]
  ) => ReturnType<ReturnType<DocumentClient["get"]>["promise"]>;
  on?: onHooks<T, Repository>;
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
    } catch (error) {
      throw createSTDDBError({
        error,
        entityTypeName: this.args.typeName,
        methodsTrace: ["parseId"],
        type: "id-validation",
      });
    }
    return id;
  }

  pickedParse<Mask extends keyof T>(
    obj: any,
    fields: Mask[],
    type: "input" | "output"
  ) {
    try {
      let mask: any = {};
      fields.forEach((field) => (mask[field] = true));
      return this.args.schema.pick(mask).parse(obj);
    } catch (error) {
      throw createSTDDBError({
        error,
        entityTypeName: this.args.typeName,
        methodsTrace: ["parseId"],
        type: type === "input" ? "input-validation" : "ouput-validation",
      });
    }
  }

  partialParse(
    obj: any,
    type: "input" | "output" = "input",
    fields?: (keyof T)[]
  ): Partial<T> {
    try {
      const parsedPartial = this.args.schema.partial().parse(obj);
      return removeUndefined(parsedPartial);
    } catch (error) {
      throw createSTDDBError({
        error,
        entityTypeName: this.args.typeName,
        methodsTrace: ["partialParse"],
        type: type === "input" ? "input-validation" : "ouput-validation",
      });
    }
  }

  /**
   *
   * @param obj
   * @returns
   */
  parse(obj: any, type: "input" | "output" = "input"): T {
    try {
      return this.args.schema.parse(obj);
    } catch (error) {
      throw createSTDDBError({
        error,
        entityTypeName: this.args.typeName,
        methodsTrace: ["parse"],
        type: type === "input" ? "input-validation" : "ouput-validation",
      });
    }
  }

  getKey(id: Id | T) {
    return this.getIndexKey(id as any, this.args.primaryIndex);
  }

  /**
   * This should be renamed to getIndexFields
   * @param thing
   * @returns
   */
  getIndexKeys(thing: T, { assert = true } = {}) {
    if (assert) {
      thing = this.parse(thing, "input");
    }
    return this.getIndexes()
      .map((i) => this.getIndexKey(thing, i))
      .reduce((prev = {}, cur) => ({ ...prev, ...cur }), {});
  }

  decorateWithKeys(
    thing: T,
    options: { assert?: boolean } = {}
  ): T & Record<string, string> {
    const keys = this.getIndexKeys(thing, { assert: !!options.assert });
    return Object.assign({}, thing, keys);
  }

  /**
   * Only writes the index fields for which every index.fields field is present
   * @param thing
   * @returns
   */
  partialDecorateWithKeys<T1 extends Partial<T>>(
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
    ] as IndexBase<T>[];
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
          `To query index: ${JSON.stringify(
            index
          )}, field: ${f} is required, recieved ${JSON.stringify(
            thing
          )}, debugInfo: ${JSON.stringify(options?.debugInfo || {})}`
        );
      }
    });

    function stringifyField(fieldName: string) {
      const stringify = index?.stringifyField?.[fieldName];
      if (stringify) {
        return stringify(fieldName, thing as IdOrT);
      } else {
        return thing[fieldName as keyof IdOrT];
      }
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
