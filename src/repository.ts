import {
  DeleteCommand,
  DynamoDBDocumentClient as DocumentClient,
  GetCommand,
  GetCommandOutput,
  PutCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { IndexBase, IndexField, Mapper, RepositoryArgs } from "./mapper";
import { getCursorEncoder, IndexQueryBuilder } from "./index-query-builder";
import { getDDBUpdateExpression } from "./utils/getDDBUpdateExpression";
import { BatchArgsHandler } from "./batch-args-handler";
import { STDError, isSingleTableDynamoError } from "./utils/errors";
import { z } from "zod";
import { goTry } from "./utils/goTry";
import { AttributeRegistry } from "./utils/AttributeRegistry";
import { getConditionExpression } from "./utils/getKeyCondition";
import { omit } from "./utils/omit";
import { batchWrite } from "./batch-write";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";

// https://www.typescriptlang.org/play?ssl=14&ssc=47&pln=14&pc=54#code/GYVwdgxgLglg9mABMGYAmAeCCDOVEAqiApgB5THo6IDeiYAhgLbEBcieATqgOaIC+AbQC6APgAUMCkxzsCAGnrM2hQWBBMARsU7DBAckYt9wgJS0AUImuJOxKCE5IpxGQDoU6SYgC8oxDBuRsS+Pj5KLKYA3Bb8FhZQAJ4ADiEAkpB2LGBQGAByJOSUaNTqWjr+4YJWiACM8gBM8gDM8gAs8gCs8gBs8gDs8gAc8gCc8rUADBP1tU21rbUdtd21fbWDtSO14w3TNQ31DU0NrQ0dDd0NfQ2DDSMN483TzfXNTc2tzR3N3c19zUGNWaI2a4za0za9TaTTarTaHTa3TafTagzaIza4060069U6TU6rU6HUQAHoyYgGNRgAxOFTqIk4CB6MRiGgam4uWVtJwROTKZoGDAADaIZn4ADuUgAFvQNLyLHo8sJ4klUogABIgOXhDIQLKUXKTUTxUCQWAIRAG4gMCgAJWIyTgOCkcE4iSwuHwAGUIDLXAxFNgwHhEBk0GRiNQyBQqIhxABrYhM4CIP0BpgMUwiCR0niySw2Dj+wPsDOB+Q1ayoSOkaPsCNRnCxcw0eLF83QeBIG124gARRAOk9IbDTdIAGkU4U4yV5eV6eETeI29Xi7Z7I4kO2N3vEJKA3ZxChiCK0I30M3BBPp4lhMG4ExknSVPowvpFAA3Bgi4fl0ssxvK96xwYC6zvYQzCLfdYLsBwnGtOx+yHEcMH1Q0cnQkC71ECRTHXWD+CrWDiyjCBVxg0iN3g7dEBEGJqOsOIiPXOJ11oxDd33ABHYcPXYSi-CQ20KFQj0MBXAji34GJYniMd8DsZ1fBE-tHWdV0oHdRJxG46wcEAhh2H0jdgnYfQuF4T9CJsBgeDfKywB4GzYM0GBOCgGULKcly2JImxa2bdgDHs4hP0QfR3M8mUTFbOTlLgdc3D4kdV2Sw8dGIcR9DCiL3x8fLfP0aSbDcTLjyijyvPyj9FEsqBuGckrkvI1cgA

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

type VerifyAgeFunc = {
  (age: number): boolean;
  usedBy: string;
};

export function createFactory<
  Schema extends z.AnyZodObject = z.AnyZodObject,
  Output extends object = z.infer<Schema>,
  PrimaryKeyField extends IndexField<Output> = IndexField<Output>,
  IndexTag extends string = string,
  SecondaryIndexTag extends string = string,
  ID extends object = Pick<Output, PrimaryKeyField>,
  Input = z.input<Schema>
>(
  args: RepositoryArgs<
    Schema,
    Output,
    PrimaryKeyField,
    IndexTag,
    SecondaryIndexTag
  >
): {
  (partialArgs?: Partial<typeof args>): Repository<
    Schema,
    Output,
    PrimaryKeyField,
    IndexTag,
    SecondaryIndexTag,
    ID,
    Input
  >;
  $idType: ID;
  $outputType: Output;
  $inputType: Input;
  args: typeof args;
} {
  const createRepo = (partialArgs: Partial<typeof args> = {}) =>
    new Repository(Object.assign({}, args, partialArgs));
  // @ts-ignore
  return Object.assign(createRepo, {
    $idType: {} as ID,
    $outputType: {} as Output,
    $inputType: {} as Input,
    args,
  });
}

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

  private async doGet(
    id: ID
  ): Promise<Exclude<GetCommandOutput["Item"], undefined> | null> {
    const args = {
      TableName: this.args.tableName,
      Key: this.mapper.getKey(id),
    };
    const res = { Item: null };
    if (this.args.dataLoader) {
      return this.args.dataLoader.load(args).then((res) => res.Item || null);
    } else {
      return this.ddb
        .send(new GetCommand(args))
        .then((res) => res.Item || null);
    }
  }

  async parseAndMigrate(rawObject: NonNullable<any>): Promise<Output> {
    const [item, err] = goTry(() => this.mapper.parse(rawObject, "output"));
    // we got a parse error :O
    if (err) {
      if (this.args.migrate) {
        return this.mapper.parse(
          await this.args.migrate(rawObject, this as any),
          "output"
        );
      }
      throw err;
    }
    return item as Output;
  }

  /**
   * Retrieves an item from the repository by its ID.
   *
   * @param id The ID of the item to retrieve.
   * @param options An optional object containing additional options:
   *   - `forceFetch`: This param is only relevant when using dataLoader. A boolean indicating whether to force the item to be fetched from the database and not from the cache.
   * @returns A promise that resolves to the retrieved item, or `undefined` if the item does not exist.
   * @throws A `SingleTableError` if there was an error retrieving the item.
   */
  async get(id: ID, { forceFetch = false } = {}) {
    try {
      if (forceFetch) {
        this.mapper.dataLoaderClear(id);
      }
      const res = await this.doGet(id);

      const item: Output | null = res ? await this.parseAndMigrate(res) : null;

      this.args.on?.get?.(
        [id as any],
        item as any,
        this.mapper.getHookResultInfo(id, res || null)
      );
      return item;
    } catch (e: any) {
      if (isSingleTableDynamoError(e)) {
        throw e;
      }
      throw new STDError({
        message: `Error getting ${this.args.typeName}`,
        cause: e,
        name: "single-table-Error",
        meta: {
          id,
          typeName: this.args.typeName,
        },
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
      throw new STDError({
        name: "single-table-Error",
        message: "Cannot merge into item that does not exist",
        meta: {
          id,
          typeName: this.args.typeName,
        },
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
        .send(
          new UpdateCommand({
            TableName: this.args.tableName,
            Key: this.mapper.getKey(id),
            ...getDDBUpdateExpression(withoutPrimaryKeys),
            ConditionExpression: getConditionExpression(
              [this.args.primaryIndex.pk, this.args.primaryIndex.sk],
              "update"
            ),
            ReturnValues: "ALL_NEW",
          })
        )
        .then((res) =>
          res.Attributes ? this.mapper.parse(res.Attributes, "output") : null
        )
        .catch((e) => {
          // we expect the ConditionalCheck to fail when
          // the attribut does not exist
          if (
            e?.name === "ConditionalCheckFailedException" ||
            e instanceof ConditionalCheckFailedException
          ) {
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
      throw new STDError({
        message: `There was an error merge: ${this.args.typeName}`,
        cause: e,
        name: "single-table-Error",
        meta: {
          updates: _updates,
          typeName: this.args.typeName,
          action: "mutate",
        },
      });
    }
  }

  expression = {
    add<T>(thing: T): [typeof AddExpr, T] {
      return [AddExpr, thing];
    },
  };

  /**
   * Puts an item into the DynamoDB table using an update expression.
   *
   * @param expr The update expression to use for the put operation.
   * @param options.mode The mode to use for the put operation. Defaults to "upsert".
   * @returns A Promise that resolves to the newly created item, or null if the item already exists and the mode is "upsert".
   */
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

    const res = await this.ddb.send(new UpdateCommand(updateArgs));

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
      await this.ddb.send(
        new PutCommand({
          TableName: this.args.tableName,
          Item: rawItem,
          ConditionExpression: getConditionExpression(
            [this.args.primaryIndex.pk, this.args.primaryIndex.sk],
            mode
          ),
        })
      );
      this.args.on?.put?.(
        [parsed, { mode }],
        parsed as any,
        this.mapper.getHookResultInfo(parsed as any, rawItem)
      );
      this.mapper.dataLoaderPrime(rawItem as any, rawItem);

      return parsed;
    } catch (e: any) {
      if (isSingleTableDynamoError(e)) {
        throw e;
      }
      throw new STDError({
        message: `There was an error putting ${this.args.typeName}`,
        cause: e,
        name: "single-table-Error",
        meta: {
          src,
          typeName: this.args.typeName,
          mode,
        },
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
      await this.ddb.send(
        new DeleteCommand({
          TableName: this.args.tableName,
          Key: this.mapper.getKey(id),
        })
      );
      this.args.on?.delete?.([id as any], true, this.mapper.getHookKeyInfo(id));
      this.mapper.dataLoaderPrime(id, null);
      return true;
    } catch (e: any) {
      if (isSingleTableDynamoError(e)) {
        throw e;
      }
      throw new STDError({
        message: `There was an error deleting ${this.args.typeName}`,
        cause: e,
        name: "single-table-Error",
        meta: {
          id,
          typeName: this.args.typeName,
        },
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
