import { DocumentClient } from "aws-sdk/clients/dynamodb";
import { FieldsToProject } from "./utils/ProjectFields";
import { Mapper, ifSecondaryIndexGetName, IndexBase } from "./mapper";
import { QueryBuilder } from "./query-builder";

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
  fieldsToProject?: FieldsToProject<T>;
  index: IndexBase<T>;
  builder?: QueryBuilder;
  ddb?: DocumentClient;
};

export class IndexQueryBuilder<Src> {
  tableName: string;
  mapper: Mapper;
  index: IndexBase<Src>;
  builder: QueryBuilder;
  ddb?: DocumentClient;
  encodeCursor: (src: Src) => string;

  constructor({
    tableName,
    mapper,
    builder,
    index,
    ddb,
    fieldsToProject,
  }: IndexQueryBuilderArgs<Src>) {
    this.tableName = tableName;
    this.mapper = mapper;
    this.index = index;
    this.ddb = ddb;
    this.builder = (builder || new QueryBuilder()).table(tableName);
    if (fieldsToProject) {
      this.builder = this.builder.project(fieldsToProject);
    }
    this.encodeCursor = getCursorEncoder({
      secondaryIndex: index,
      primaryIndex: mapper.args.primaryIndex,
      mapper,
    });
    const secondaryIndexName = ifSecondaryIndexGetName(index);
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
      builder: builder.cloneWith(),
    });
  }

  limit(t: number) {
    return this.clone(this.builder.limit(t));
  }

  project(fieldsToProject: FieldsToProject<Src>) {
    return this.clone(this.builder.project(fieldsToProject));
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
    if (this.ddb) {
      const expression = this.builder.build();
      let res = (await this.ddb.query(expression as any).promise()) as Omit<
        DocumentClient.QueryOutput,
        "Items"
      > & {
        Items?: Src[];
      };
      this.mapper.args.on?.query?.(expression, res);
      return Object.assign(res, {
        encodeCursor: this.encodeCursor,
        lastCursor: res.Items?.length
          ? this.encodeCursor(res.Items[res.Items.length - 1])
          : undefined,
      });
    } else {
      throw new Error(
        "a document client instance must be provided to the constructor in order to execute queries"
      );
    }
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
