import { DocumentClient } from "aws-sdk/clients/dynamodb";
import { IndexBase, IndexField, Mapper, RepositoryArgs } from "./mapper";
import { getCursorEncoder, IndexQueryBuilder } from "./index-query-builder";
import { getDDBUpdateExpression } from "./utils/getDDBUpdateExpression";
import { BatchArgsHandler } from "./batch-args-handler";
import {
  FieldsToProject,
  toProjectionExpression,
  getDefaultFieldsToProject,
} from "./utils/ProjectFields";
import { handleError } from "./utils/errorHandling";

type ExtraQueryParams<T> = {
  fieldsToProject: FieldsToProject<T>;
};

export class Repository<
  Src = any,
  PrimaryKeyField extends IndexField<Src> = IndexField<Src>,
  IndexTag extends string = string,
  SecondaryIndexTag extends string = string,
  ID = Pick<Src, PrimaryKeyField>
> {
  args: RepositoryArgs<Src, PrimaryKeyField, IndexTag, SecondaryIndexTag>;
  mapper: Mapper<Src, PrimaryKeyField, IndexTag, SecondaryIndexTag, ID>;
  batch: BatchArgsHandler<ID, Src>;
  ddb: DocumentClient;

  constructor(
    args: RepositoryArgs<Src, PrimaryKeyField, IndexTag, SecondaryIndexTag>,
    ddb: DocumentClient
  ) {
    this.args = args;
    this.mapper = new Mapper(args);
    this.batch = new BatchArgsHandler<ID, Src>(this.mapper as any);
    this.ddb = ddb;
  }

  private doGet(id: ID, extraParams: ExtraQueryParams<Src>) {
    const args = {
      TableName: this.args.tableName,
      ...toProjectionExpression(extraParams.fieldsToProject),
      Key: this.mapper.getKey(id),
    };

    return this.args.getDocument
      ? this.args.getDocument(args)
      : this.ddb.get(args).promise();
  }

  async get(
    id: ID,
    extraParams: ExtraQueryParams<Src> = {
      fieldsToProject: getDefaultFieldsToProject<Src>(this.args as any),
    }
  ) {
    try {
      const res = await this.doGet(id, extraParams);

      let item: Src | null = res.Item
        ? this.mapper.pickedParse(
            res.Item,
            extraParams.fieldsToProject,
            "output"
          )
        : null;
      this.args.on?.get?.([id, extraParams], item, this.getHookKeyInfo(id));
      return item;
    } catch (e) {
      throw handleError(e, "get", this.mapper.args.typeName);
    }
  }

  getKey(id: ID | Src) {
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
    _updates: Partial<Src>,
    options: {
      objectToPutIfNotExists?: Src;
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
    } catch (e) {
      throw handleError(e, "partialUpdate", this.mapper.args.typeName);
    }
  }

  async updateUnsafe(
    id: ID,
    src: Partial<Src>,
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
        this.args.on?.updateUnsafe?.(
          [id, src, options],
          updated,
          this.getHookKeyInfo(updated)
        );
      }

      return updated;
    } catch (e) {
      throw handleError(e, "updateUnsafe", this.mapper.args.typeName);
    }
  }

  private getHookKeyInfo(thing: Src | ID) {
    return {
      TableName: this.args.tableName,
      Key: this.getKey(thing),
    };
  }

  async put(src: Src) {
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
    } catch (e) {
      throw handleError(e, "put", this.mapper.args.typeName);
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
    } catch (e) {
      throw handleError(e, "get", this.mapper.args.typeName);
    }
  }
  getIndexByTag(indexTag: IndexTag | SecondaryIndexTag): IndexBase<Src> {
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
    const builder = new IndexQueryBuilder<Src>({
      tableName: this.args.tableName,
      index: this.getIndexByTag(indexTag),
      mapper: this.mapper as any,
      fieldsToProject: getDefaultFieldsToProject(this.args),
      ddb: this.ddb,
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

export type InferObjectType<Repo> = Repo extends Repository<infer T, any>
  ? T
  : never;
export type InferIdType<Repo> = Repo extends Repository<infer T, infer IdField>
  ? Pick<T, IdField>
  : never;
