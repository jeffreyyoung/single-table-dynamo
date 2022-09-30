import { DocumentClient } from "aws-sdk/clients/dynamodb";
import { Mapper, ifSecondaryIndexGetName, IndexBase } from "./mapper";
import { QueryBuilder } from "./query-builder";
import { AnyRepository } from "./repository";

export function getCursorEncoder<Src>(args: {
  primaryIndex: IndexBase<Src>;
  secondaryIndex: IndexBase<Src>;
  mapper: Mapper;
}) {
  return (src: Src) => {
    return JSON.stringify({
      ...args.mapper.getIndexKey(src, args.primaryIndex),
      ...(args.secondaryIndex &&
        args.mapper.getIndexKey(src, args.secondaryIndex)),
    });
  };
}

type IndexQueryBuilderArgs<T> = {
  tableName: string;
  mapper: Mapper;
  parseAndMigrate: AnyRepository["parseAndMigrate"];
  index: IndexBase<T>;
  builder?: QueryBuilder;
  ddb: DocumentClient;
};

export class IndexQueryBuilder<Src> {
  tableName: string;
  mapper: AnyRepository["mapper"];
  index: IndexBase<Src>;
  parseAndMigrate: AnyRepository["parseAndMigrate"];
  builder: QueryBuilder;
  ddb: DocumentClient;
  encodeCursor: (src: Src) => string;

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
    return this.clone(this.builder.cursor(JSON.parse(str)));
  }

  build() {
    return this.builder.build();
  }

  async exec() {
    const expression = this.builder.build();
    const _res = await this.ddb.query(expression as any).promise();
    let res = {
      ..._res,
      Items: (await Promise.all(
        (_res.Items || []).map((item) => {
          return this.parseAndMigrate(item);
        })
      )) as Src[],
    };

    this.mapper.args.on?.query?.(expression, res);
    return Object.assign(res, {
      encodeCursor: this.encodeCursor,
      lastCursor: res.Items?.length
        ? this.encodeCursor(res.Items[res.Items.length - 1])
        : undefined,
    });
  }

  async execOne() {
    const res = await this.limit(1).exec();
    return res.Items?.[0];
  }

  async *execAll() {
    let cursor: string | null = null;
    do {
      // @ts-ignore
      const { Items, lastCursor } = await (cursor
        ? this.cursor(cursor).exec()
        : this.exec());
      if (Items?.length) {
        yield Items;
      }
      cursor = lastCursor;
    } while (cursor);
  }

  where(src: Partial<Src>) {
    let builder = this.builder;
    const indexes = this.mapper.getIndexKey(src as Src, this.index, {
      partial: true,
    }) as any;
    if (indexes[this.index.pk]) {
      builder = builder.where(
        this.index.pk as any,
        "=",
        indexes[this.index.pk]
      );
    }

    if (indexes[this.index.sk!]) {
      builder = builder.where(
        this.index.sk as any,
        "BEGINS_WITH",
        indexes[this.index.sk!]
      );
    }

    return this.clone(builder);
  }
}
