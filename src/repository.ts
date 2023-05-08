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
  Output = z.infer<Schema>,
  PrimaryKeyField extends IndexField<Output> = IndexField<Output>,
  IndexTag extends string = string,
  SecondaryIndexTag extends string = string,
  ID = Pick<Output, PrimaryKeyField>,
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
    >,
    ddb: DocumentClient
  ) {
    this.args = args;
    this.mapper = new Mapper(args);
    this.batch = new BatchArgsHandler<ID, Schema>(this.mapper as any);
    this.ddb = ddb;
  }

  private async doGet(id: ID): Promise<DocumentClient.AttributeMap | null> {
    const args = {
      TableName: this.args.tableName,
      Key: this.mapper.getKey(id),
    };

    const res = await (this.args.getDocument
      ? this.args.getDocument(args)
      : this.ddb.get(args).promise());

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

  async get(id: ID) {
    try {
      const res = await this.doGet(id);

      const item: Output | null = res ? await this.parseAndMigrate(res) : null;

      this.args.on?.get?.([id as any], item as any, this.getHookKeyInfo(id));
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

  getKey(id: ID | Output) {
    return this.mapper.getKey(id);
  }

  /**
   *
   * @param updates
   * @param options
   * @returns
   */
  async merge(
    updates: ID & Partial<Input>,
    options: {
      objectToPutIfNotExists?: Input;
    }
  ): Promise<Output> {
    const id = updates;
    const existing = await this.get(id);

    if (!existing && options.objectToPutIfNotExists) {
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
   * Returns null if the object does not exist and does not update.
   * Only updates indexes where every index dependency is present in the updates
   * param
   * @param id
   * @param updates
   * @param options.upsertArgs If present and the document with id does not
   *                           exist, a put will occur with the upsert args
   */
  async partialUpdate(
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
      return updated;
    } catch (e: any) {
      if (isSingleTableDynamoError(e)) {
        throw e;
      }
      throw createSTDError({
        message: `There was an error partialUpdate: ${this.args.typeName}`,
        cause: e,
        name: "single-table-Error",
      });
    }
  }

  /**
   * This method is dangerous because no migration code is run
   *
   * @param id
   * @param src
   * @param options
   * @returns
   */
  async dangerouslyUpdate(
    id: ID,
    src: Partial<Output>,
    options: { upsert: boolean; returnValues?: "ALL_NEW" | "ALL_OLD" } = {
      upsert: false,
    }
  ): Promise<Output | null> {
    try {
      const updates = this.mapper.partialParse(src, "input");

      const res = await this.ddb
        .update({
          TableName: this.args.tableName,
          Key: this.mapper.getKey(id),
          ...getDDBUpdateExpression(updates),
          ConditionExpression: getConditionExpression(
            [this.args.primaryIndex.pk, this.args.primaryIndex.sk],
            options.upsert ? "upsert" : "update"
          ),
          ReturnValues: options?.returnValues ?? "ALL_NEW",
        })
        .promise();
      let updated = res.Attributes
        ? this.mapper.parse(res.Attributes, "output")
        : null;

      if (updated) {
        this.args.on?.dangerouslyUpdate?.(
          [id as any, src, options],
          updated,
          this.getHookKeyInfo(updated)
        );
      }

      return updated;
    } catch (e: any) {
      if (isSingleTableDynamoError(e)) {
        throw e;
      }
      console.error(e);
      throw createSTDError({
        message: `There was an error dangerouslyUpdate ${this.args.typeName}`,
        cause: e,
        name: "single-table-Error",
      });
    }
  }

  private getHookKeyInfo(thing: Output | ID) {
    return {
      TableName: this.args.tableName,
      Key: this.getKey(thing),
    };
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

    let ConditionExpression = getConditionExpression(
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

    let updated = res.Attributes
      ? this.mapper.parse(res.Attributes, "output")
      : null;

    if (updated) {
      // todo
      this.args.on?.put?.([updated], updated, this.getHookKeyInfo(updated));
    }

    return updated;
  }

  async put(src: Input, { mode = "upsert" }: ModeOption = {}): Promise<Output> {
    try {
      const parsed = this.mapper.parse(src, "input");
      await this.ddb
        .put({
          TableName: this.args.tableName,
          Item: this.mapper.decorateWithKeys(parsed),
          ConditionExpression: getConditionExpression(
            [this.args.primaryIndex.pk, this.args.primaryIndex.sk],
            mode
          ),
        })
        .promise();
      this.args.on?.put?.(
        [src as any, { mode }],
        parsed as any,
        this.getHookKeyInfo(parsed)
      );
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

  async delete(id: ID): Promise<boolean> {
    try {
      await this.ddb
        .delete({
          TableName: this.args.tableName,
          Key: this.mapper.getKey(id),
        })
        .promise();
      this.args.on?.delete?.([id as any], true, this.getHookKeyInfo(id));
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
