import { DocumentClient } from "aws-sdk/clients/dynamodb";
import { IndexBase, IndexField, Mapper, RepositoryArgs } from "./mapper";
import { getCursorEncoder, IndexQueryBuilder } from "./index-query-builder";
import { getDDBUpdateExpression } from "./utils/getDDBUpdateExpression";
import { BatchArgsHandler } from "./batch-args-handler";
import {
  FieldsToProject,
  toProjectionExpression,
  getAllProjectableFields,
} from "./utils/ProjectFields";
import { createSTDError, isSingleTableDynamoError } from "./utils/errors";
import { z } from "zod";
import { goTry } from "./utils/goTry";

type GetOptions<T> = {
  fieldsToProject: FieldsToProject<T>;
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

  private async doGet(
    id: ID,
    options: GetOptions<Output>
  ): Promise<DocumentClient.AttributeMap | null> {
    console.log("doGet", id, options.fieldsToProject);
    const args = {
      TableName: this.args.tableName,
      ...toProjectionExpression(options.fieldsToProject),
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

  private defaultGetOptions(): GetOptions<Output> {
    return {
      fieldsToProject: getAllProjectableFields(this.args),
    };
  }

  async parseAndMigrate(
    rawObject: NonNullable<any>,
    options: GetOptions<Output> = this.defaultGetOptions()
  ): Promise<Output> {
    console.log("in parseAndMigrate", rawObject, options.fieldsToProject);
    const [item, err] = goTry(() =>
      this.mapper.pickedParse(rawObject, options.fieldsToProject, "output")
    );
    // we got a parse error :O
    if (err) {
      console.log("there was an error parsing");
      if (this.args.migrate) {
        console.log("there is a migration fn found, will migrate");
        const hasAllFields = this.isProjectingAllFieldsForMigration(
          options.fieldsToProject
        );
        const objectWithAllFields = hasAllFields
          ? rawObject
          : await this.doGet(this.mapper.parseId(rawObject), {
              fieldsToProject: this.getMigrationProjectionFields() as any,
            });
        console.log(
          "attempting migrate",
          objectWithAllFields,
          options.fieldsToProject
        );
        return this.mapper.pickedParse(
          await this.args.migrate(objectWithAllFields),
          options.fieldsToProject,
          "output"
        ) as any;
      }
      console.log("no migration fn found, throwing error");
      throw err;
    }
    return item as Output;
  }

  private getMigrationProjectionFields(): string[] {
    const migrationFields = getAllProjectableFields(this.args).concat(
      (this.args.fieldsNotPresentInSchemaButNeededForMigration || []) as any
    );
    console.log("getMigrationProjectionFields", migrationFields);
    return migrationFields;
  }

  isProjectingAllFieldsForMigration(fieldsToProject: FieldsToProject<Output>) {
    const s = new Set<string>(fieldsToProject);
    const allFields = this.getMigrationProjectionFields();
    return allFields.every((f) => s.has(f));
  }

  async get(id: ID, options: GetOptions<Output> = this.defaultGetOptions()) {
    try {
      const res = await this.doGet(id, options);

      const item: Output | null = res
        ? await this.parseAndMigrate(res, options)
        : null;

      this.args.on?.get?.([id, options as any], item, this.getHookKeyInfo(id));
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
   * Returns null if the object does not exist and does not update.
   * Only updates indexes where every index dependency is present in the updates
   * param
   * @param id
   * @param updates
   * @param options.upsertArgs If present and the document with id does not
   *                           exist, a put will occur with the upsert args
   */
  async partialUpdate(
    _id: ID,
    _updates: Partial<Input>,
    options: {
      objectToPutIfNotExists?: Input;
    } = {}
  ) {
    try {
      const id = _id;
      const updates = this.mapper.partialParse(_updates, "input");
      const decoratedUpdates = this.mapper.partialDecorateWithKeys(updates);

      const updated = await this.ddb
        .update({
          TableName: this.args.tableName,
          Key: this.mapper.getKey(id),
          ...getDDBUpdateExpression(
            decoratedUpdates,
            Object.keys(this.mapper.getKey(id))
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
  ) {
    try {
      const updates = this.mapper.partialParse(src, "input");

      const res = await this.ddb
        .update({
          TableName: this.args.tableName,
          Key: this.mapper.getKey(id),
          ...getDDBUpdateExpression(
            updates,
            options.upsert ? [] : Object.keys(this.mapper.getKey(id))
          ),
          ReturnValues: options?.returnValues ?? "ALL_NEW",
        })
        .promise();
      let updated = res.Attributes
        ? this.mapper.parse(res.Attributes, "output")
        : null;

      if (updated) {
        this.args.on?.dangerouslyUpdate?.(
          [id, src, options],
          updated,
          this.getHookKeyInfo(updated)
        );
      }

      return updated;
    } catch (e: any) {
      if (isSingleTableDynamoError(e)) {
        throw e;
      }
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

  async put(src: Input) {
    try {
      const parsed = this.mapper.parse(src, "input");
      await this.ddb
        .put({
          TableName: this.args.tableName,
          Item: this.mapper.decorateWithKeys(parsed),
        })
        .promise();
      this.args.on?.put?.([src], parsed, this.getHookKeyInfo(parsed));
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

  async delete(id: ID) {
    try {
      await this.ddb
        .delete({
          TableName: this.args.tableName,
          Key: this.mapper.getKey(id),
        })
        .promise();
      this.args.on?.delete?.([id], true, this.getHookKeyInfo(id));
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

  query(indexTag: IndexTag | SecondaryIndexTag) {
    const builder = new IndexQueryBuilder<Output>({
      tableName: this.args.tableName,
      index: this.getIndexByTag(indexTag),
      mapper: this.mapper as AnyRepository["mapper"],
      fieldsToProject: getAllProjectableFields(this.args),
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
