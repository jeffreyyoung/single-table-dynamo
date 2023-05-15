import { DocumentClient } from "aws-sdk/clients/dynamodb";
import { IndexBase, IndexField, Mapper, RepositoryArgs } from "./mapper";
import { getCursorEncoder, IndexQueryBuilder } from "./index-query-builder";
import { getDDBUpdateExpression } from "./utils/getDDBUpdateExpression";
import { BatchArgsHandler } from "./batch-args-handler";
import { createSTDError, isSingleTableDynamoError } from "./utils/errors";
import { z } from "zod";
import { goTry } from "./utils/goTry";
import { AttributeRegistry } from "./utils/AttributeRegistry";
import { getConditionExpression } from "./utils/getKeyCondition";
import { omit } from "./utils/omit";
import { batchWrite } from "./batch-write";

type ModeOption = {
  mode?: "create" | "upsert" | "update";
};

const AddExpr = Symbol("Add");
// const SetExpr = Symbol("Set");
// const RemoveExpr = Symbol("Remove");
// const DeleteExpr = Symbol("Delete");

type UpdateExpression<T> = {
  [Property in keyof T]: T[Property] | [typeof AddExpr, T[Property]];
};

export class Repository<
  Schema extends z.AnyZodObject = z.AnyZodObject,
  Output extends object = z.infer<Schema>,
  PrimaryKeyField extends IndexField<Output> = IndexField<Output>,
  IndexTag extends string = string,
  SecondaryIndexTag extends string = string,
  ID extends object = Pick<Output, PrimaryKeyField>,
  Input = z.input<Schema>
> {
  args: RepositoryArgs<
    Schema,
    Output,
    PrimaryKeyField,
    IndexTag,
    SecondaryIndexTag
  >;
  mapper: Mapper<
    Schema,
    Output,
    PrimaryKeyField,
    IndexTag,
    SecondaryIndexTag,
    ID
  >;
  batch: BatchArgsHandler<ID, Schema>;
  ddb: DocumentClient;

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
    this.mapper = new Mapper(args);
    this.batch = new BatchArgsHandler<ID, Schema>(this.mapper as any);
    this.ddb = this.args.documentClient;
  }

  private async doGet(id: ID): Promise<DocumentClient.AttributeMap | null> {
    const args = {
      TableName: this.args.tableName,
      Key: this.mapper.getKey(id),
    };
    let res = { Item: null };
    if (this.args.dataLoader) {
      return this.args.dataLoader.load(args).then((res) => res.Item || null);
    } else {
      return this.ddb
        .get(args)
        .promise()
        .then((res) => res.Item || null);
    }
    // const res = await (this.args.dataLoader
    //   ? this.args.dataLoader.load(args)
    //   : this.ddb.get(args).promise());

    if (!res.Item) {
      return null;
    }
    return res.Item;
  }

  async parseAndMigrate(rawObject: NonNullable<any>): Promise<Output> {
    const [item, err] = goTry(() => this.mapper.parse(rawObject, "output"));
    // we got a parse error :O
    if (err) {
      if (this.args.migrate) {
        return this.mapper.parse(await this.args.migrate(rawObject), "output");
      }
      throw err;
    }
    return item as Output;
  }

  /**
   * Get a single item by id
   *
   * Returns null if the item does not exist
   *
   * @param id
   * @returns
   */
  async get(id: ID) {
    try {
      const res = await this.doGet(id);

      const item: Output | null = res ? await this.parseAndMigrate(res) : null;

      this.args.on?.get?.(
        [id as any],
        item as any,
        this.mapper.getHookResultInfo(id, res)
      );
      return item;
    } catch (e: any) {
      if (isSingleTableDynamoError(e)) {
        throw e;
      }
      throw createSTDError({
        message: `Error getting ${this.args.typeName}`,
        cause: e,
        name: "single-table-Error",
      });
    }
  }

  /**
   *
   * @param id
   * @returns
   */
  getKey(id: ID | Output) {
    return this.mapper.getKey(id);
  }

  /**
   *
   * Invokes repository.get to get the item,
   * then invokes repository.put to update the item.
   *
   * If the item does not exist and objectToPutIfNotExists is not defined,
   * and error is thrown.
   *
   * @param updates
   * @param options
   * @returns
   */
  async merge(
    updates: ID & Partial<Input>,
    options?: {
      objectToPutIfNotExists?: Input;
    }
  ): Promise<Output> {
    const id = updates;
    const existing = await this.get(id);

    if (!existing && options?.objectToPutIfNotExists) {
      return this.put(options.objectToPutIfNotExists, { mode: "create" });
    }
    if (!existing) {
      throw createSTDError({
        name: "single-table-Error",
        message: "Cannot merge into item that does not exist",
      });
    }

    const merged: Input = { ...existing, ...updates } as any;

    return this.put(merged, { mode: "update" });
  }

  /**
   * Mutates the item in place it exists and returns null if it does not exist.
   * There is risk to using this method as it does not update all indexes.
   * If you need to update all indexes, use repository.merge instead.
   *
   * @param id
   * @param updates
   * @param options.upsertArgs If present and the document with id does not
   *                           exist, a put will occur with the upsert args
   */
  async mutate(
    _updates: ID & Partial<Input>,
    options: {
      objectToPutIfNotExists?: Input;
    } = {}
  ): Promise<Output | null> {
    try {
      const id = _updates;
      const updates = this.mapper.partialParse(_updates, "input");
      const decoratedUpdates = this.mapper.partialDecorateWithKeys(updates);
      const withoutPrimaryKeys = omit(decoratedUpdates, [
        this.args.primaryIndex.pk,
        this.args.primaryIndex.sk,
      ]);
      const updated = await this.ddb
        .update({
          TableName: this.args.tableName,
          Key: this.mapper.getKey(id),
          ...getDDBUpdateExpression(withoutPrimaryKeys),
          ConditionExpression: getConditionExpression(
            [this.args.primaryIndex.pk, this.args.primaryIndex.sk],
            "update"
          ),
          ReturnValues: "ALL_NEW",
        })
        .promise()
        .then((res) =>
          res.Attributes ? this.mapper.parse(res.Attributes, "output") : null
        )
        .catch((e) => {
          // we expect the ConditionalCheck to fail when
          // the attribut does not exist
          if (e.code === "ConditionalCheckFailedException") {
            return null;
          } else {
            throw e;
          }
        });

      if (!updated && options.objectToPutIfNotExists) {
        return this.put(options.objectToPutIfNotExists);
      }
      this.mapper.dataLoaderPrime(_updates, updated);
      this.args.on?.mutate?.(
        [_updates, options as any],
        updated as any,
        this.mapper.getHookResultInfo(_updates, updated ?? null)
      );
      return updated;
    } catch (e: any) {
      if (isSingleTableDynamoError(e)) {
        throw e;
      }
      throw createSTDError({
        message: `There was an error merge: ${this.args.typeName}`,
        cause: e,
        name: "single-table-Error",
      });
    }
  }

  expression = {
    add<T>(thing: T): [typeof AddExpr, T] {
      return [AddExpr, thing];
    },
  };

  async putExpression(
    expr: ID & UpdateExpression<Omit<Input, keyof ID>>,
    { mode = "upsert" }: ModeOption = {}
  ): Promise<Output | null> {
    const operationMap: Record<string, "ADD" | "SET"> = {};
    const src: Input = Object.fromEntries(
      Object.entries(expr).map(([key, value]) => {
        if (Array.isArray(value) && value[0] === AddExpr) {
          operationMap[key] = "ADD";
          return [key, value[1]];
        }
        operationMap[key] = "SET";
        return [key, value];
      })
    ) as any;

    const parsed = this.mapper.parse({ ...src }, "input");
    const decorated = this.mapper.decorateWithKeys(parsed);

    const setExpressions: string[] = [];
    const addExpressions: string[] = [];
    const registry = new AttributeRegistry();

    for (const [key, value] of Object.entries(decorated)) {
      if (
        key === this.args.primaryIndex.pk ||
        key === this.args.primaryIndex.sk
      ) {
        // skip updates to primary key and sort key
      } else if (operationMap[key] === "ADD") {
        addExpressions.push(`${registry.key(key)} ${registry.value(value)}`);
      } else {
        // SET
        setExpressions.push(`${registry.key(key)} = ${registry.value(value)}`);
      }
    }

    const UpdateExpression = [
      setExpressions.length > 0 ? `SET ${setExpressions.join(", ")}` : null,
      addExpressions.length > 0 ? `ADD ${addExpressions.join(", ")}` : null,
    ]
      .filter((i) => i)
      .join(" ");

    const ConditionExpression = getConditionExpression(
      [this.args.primaryIndex.pk, this.args.primaryIndex.sk],
      mode
    );
    const updateArgs = {
      TableName: this.args.tableName,
      Key: this.mapper.getKey(expr),
      ...registry.get(),
      UpdateExpression,
      ConditionExpression,
      ReturnValues: "ALL_NEW",
    };

    const res = await this.ddb.update(updateArgs).promise();

    const updated = res.Attributes
      ? this.mapper.parse(res.Attributes, "output")
      : null;

    if (updated) {
      // todo
      this.args.on?.put?.(
        [updated],
        updated,
        this.mapper.getHookResultInfo(expr, res.Attributes ?? null)
      );
    }
    if (updated) {
      this.mapper.dataLoaderPrime(updated as any, updated as any);
    }

    return updated;
  }

  async put(src: Input, { mode = "upsert" }: ModeOption = {}): Promise<Output> {
    try {
      const parsed = this.mapper.parse(src, "input");
      const rawItem = this.mapper.decorateWithKeys(parsed);
      await this.ddb
        .put({
          TableName: this.args.tableName,
          Item: rawItem,
          ConditionExpression: getConditionExpression(
            [this.args.primaryIndex.pk, this.args.primaryIndex.sk],
            mode
          ),
        })
        .promise();
      this.args.on?.put?.(
        [src as any, { mode }],
        parsed as any,
        this.mapper.getHookResultInfo(src as any, rawItem)
      );
      this.mapper.dataLoaderPrime(rawItem as any, rawItem);

      return parsed;
    } catch (e: any) {
      if (isSingleTableDynamoError(e)) {
        throw e;
      }
      throw createSTDError({
        message: `There was an error putting ${this.args.typeName}`,
        cause: e,
        name: "single-table-Error",
      });
    }
  }

  async deleteMany(ids: ID[]): Promise<boolean[]> {
    return batchWrite({
      ddb: this.ddb,
      requests: ids.map((id) => this.batch.delete(id)),
      dataLoader: this.args.dataLoader,
    });
  }

  putMany(objs: Input[]): Promise<Output[]> {
    return batchWrite({
      ddb: this.ddb,
      requests: objs.map((obj) => this.batch.put(obj as any)),
      dataLoader: this.args.dataLoader,
    }).then((res) => res.map((i) => this.mapper.parse(i, "output")));
  }

  async delete(id: ID): Promise<boolean> {
    try {
      await this.ddb
        .delete({
          TableName: this.args.tableName,
          Key: this.mapper.getKey(id),
        })
        .promise();
      this.args.on?.delete?.([id as any], true, this.mapper.getHookKeyInfo(id));
      this.mapper.dataLoaderPrime(id, null);
      return true;
    } catch (e: any) {
      if (isSingleTableDynamoError(e)) {
        throw e;
      }
      throw createSTDError({
        message: `There was an error deleting ${this.args.typeName}`,
        cause: e,
        name: "single-table-Error",
      });
    }
  }
  getIndexByTag(indexTag: IndexTag | SecondaryIndexTag): IndexBase<Output> {
    let index;
    if (this.args.secondaryIndexes?.[indexTag as SecondaryIndexTag]) {
      index = this.args.secondaryIndexes[indexTag as SecondaryIndexTag];
    } else if (this.args.primaryIndex.tag === indexTag) {
      index = this.args.primaryIndex;
    }
    if (!index) {
      throw new Error("expected an index, but did not get one");
    }
    return index;
  }

  query(indexTag: IndexTag | SecondaryIndexTag): IndexQueryBuilder<Output> {
    const builder = new IndexQueryBuilder<Output>({
      tableName: this.args.tableName,
      index: this.getIndexByTag(indexTag),
      mapper: this.mapper as AnyRepository["mapper"],
      ddb: this.ddb,
      parseAndMigrate: this.parseAndMigrate.bind(this),
    });
    return builder;
  }

  getCursorEncoder(indexTag: IndexTag | SecondaryIndexTag) {
    return getCursorEncoder({
      secondaryIndex: this.getIndexByTag(indexTag),
      primaryIndex: this.args.primaryIndex,
      mapper: this.mapper as any,
    });
  }
}

export type AnyRepository = Repository<any, any, any, any, any, any, any>;

export type InferInputType<Repo extends AnyRepository> =
  Repo extends Repository<any, any, any, any, any, any, infer Input>
    ? Input
    : never;

export type InferObjectType<Repo extends AnyRepository> =
  Repo extends Repository<any, infer Output, any, any, any, any, any>
    ? Output
    : never;
export type InferIdType<Repo extends AnyRepository> = Repo extends Repository<
  any,
  infer T,
  infer IdField
>
  ? Pick<T, IdField>
  : never;
