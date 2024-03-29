import {
  DynamoDBDocumentClient as DocumentClient,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  Mapper,
  ifSecondaryIndexGetName,
  IndexBase,
  RawResult,
} from "./mapper";
import { Operator, QueryBuilder } from "./query-builder";
import { AnyRepository } from "./repository";

export function decodeCursor(cursor: string): object {
  const decodedCursor = Buffer.from(cursor, "base64").toString("utf-8");
  return JSON.parse(decodedCursor);
}

export function getCursorEncoder<Src extends object>(args: {
  primaryIndex: IndexBase<Src>;
  secondaryIndex: IndexBase<Src>;
  mapper: Mapper;
}) {
  return (src: Src) => {
    const json = {
      ...args.mapper.getIndexKey(src, args.primaryIndex),
      ...(args.secondaryIndex &&
        args.mapper.getIndexKey(src, args.secondaryIndex)),
    };

    return encodeFromKeys(json);
  };
}

export function encodeFromKeys(args: Record<string, string>) {
  return Buffer.from(JSON.stringify(args)).toString("base64");
}

type IndexQueryBuilderArgs<T> = {
  tableName: string;
  mapper: Mapper;
  parseAndMigrate: AnyRepository["parseAndMigrate"];
  index: IndexBase<T>;
  builder?: QueryBuilder;
  ddb: DocumentClient;
};

export class IndexQueryBuilder<Src extends object> {
  tableName: string;
  mapper: AnyRepository["mapper"];
  index: IndexBase<Src>;
  parseAndMigrate: AnyRepository["parseAndMigrate"];
  builder: QueryBuilder;
  ddb: DocumentClient;
  encodeCursor: (src: Src) => string;
  decodeCursor = decodeCursor;

  constructor(args: IndexQueryBuilderArgs<Src>) {
    this.tableName = args.tableName;
    this.mapper = args.mapper;
    this.index = args.index;
    this.ddb = args.ddb;
    this.parseAndMigrate = args.parseAndMigrate;
    this.builder = (args.builder || new QueryBuilder()).table(args.tableName);

    this.encodeCursor = getCursorEncoder<any>({
      secondaryIndex: args.index,
      primaryIndex: args.mapper.args.primaryIndex,
      mapper: args.mapper,
    });
    const secondaryIndexName = ifSecondaryIndexGetName(args.index);
    if (secondaryIndexName) {
      this.builder = this.builder.index(secondaryIndexName);
    }
  }

  clone(builder: QueryBuilder = this.builder) {
    return new IndexQueryBuilder<Src>({
      tableName: this.tableName,
      mapper: this.mapper,
      index: this.index,
      ddb: this.ddb,
      parseAndMigrate: this.parseAndMigrate,
      builder: builder.cloneWith(),
    });
  }

  limit(t: number) {
    return this.clone(this.builder.limit(t));
  }

  sort(direction: "asc" | "desc") {
    return this.clone(this.builder.sort(direction));
  }

  cursor(str: string) {
    const decoded = this.decodeCursor(str);
    return this.clone(this.builder.cursor(decoded));
  }

  build() {
    return this.builder.build();
  }

  filter<K extends keyof Src>(key: K, op: Operator, value: Src[K]) {
    if (typeof key === "string") {
      return this.clone(this.builder.filter(key, op, value as any));
    } else {
      throw new Error("key in filter(key, op, value) must be a string");
    }
  }

  async exec({
    parseExceptionBehavior = "throw",
  }: {
    parseExceptionBehavior?: "throw" | "ignore";
  } = {}) {
    const expression = this.builder.build();
    this.mapper.args.on?.queryStart?.(expression);
    const _res = await this.ddb.send(new QueryCommand(expression));
    const res = {
      ..._res,
      Items: (await Promise.all(
        (_res.Items || []).map((item) => {
          return this.parseAndMigrate(item).catch((error) => {
            if (parseExceptionBehavior === "throw") {
              throw error;
            }
            return item;
          });
        })
      )) as Src[],
    };
    const hookInfo: RawResult[] =
      _res.Items?.flatMap((Item) =>
        Item
          ? [this.mapper.getHookResultInfo(this.mapper.parseId(Item), Item)]
          : []
      ) ?? [];
    if (this.mapper.args.dataLoader) {
      for (const result of hookInfo) {
        this.mapper.args.dataLoader.clear(result).prime(result, {
          Item: result.Item || undefined,
          $metadata: {} as any,
        });
      }
    }
    this.mapper.args.on?.query?.(expression, hookInfo);

    return Object.assign(res, {
      hasNextPage: !!res.LastEvaluatedKey,
      encodeCursor: this.encodeCursor,
      lastCursor: res.LastEvaluatedKey
        ? encodeFromKeys(res.LastEvaluatedKey)
        : undefined,
    });
  }

  /**
   * Executes the query and returns the first item in the result set.
   * @returns The first item in the result set.
   */
  async execOne(): Promise<Src | undefined> {
    const res = await this.limit(1).exec();
    return res.Items?.[0];
  }

  /**
   * iterates over the query result set in batches
   *
   *
   *
   * @returns An async iterator that yields the result set in batches.
   * @example
   *    for await (const items of queryBuilder.execAll()) {
   *      console.log(items);
   *    }
   */
  async *execAll(): AsyncGenerator<Src[]> {
    let cursor: string | null = null;
    type Page = {
      Items: Src[];
      lastCursor?: string;
    };
    do {
      const page: Page = await (cursor
        ? this.cursor(cursor).exec()
        : this.exec());
      if (page.Items?.length) {
        yield page.Items;
      }
      cursor = page.lastCursor || null;
    } while (cursor);
  }

  where(src: Partial<Src>) {
    let builder = this.builder;
    const indexedKeyToValue = this.mapper.getIndexKey(src as Src, this.index, {
      partial: true,
    }) as any;
    const hasEveryField = this.index.fields.every((f) => hasOwn(src, f));
    if (indexedKeyToValue[this.index.pk]) {
      builder = builder.where(
        this.index.pk as any,
        "=",
        indexedKeyToValue[this.index.pk]
      );
    }

    if (indexedKeyToValue[this.index.sk!]) {
      if (hasEveryField) {
        builder = builder.where(
          this.index.sk as any,
          "=",
          indexedKeyToValue[this.index.sk!]
        );
      } else {
        builder = builder.where(
          this.index.sk as any,
          "BEGINS_WITH",
          indexedKeyToValue[this.index.sk!] // TODO + '#'
        );
      }
    }

    return this.clone(builder);
  }
}

function hasOwn(thing: object, field: string) {
  if (typeof thing === "object") {
    return Object.prototype.hasOwnProperty.call(thing, field);
  }
  return false;
}
