import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import { Mapper, Index, isSecondaryIndex } from "./mapper";
import { QueryBuilder } from './query-builder';

export function getCursorEncoder<Id, Src, IndexTagNames>(args: {
  primaryIndex: Index<IndexTagNames>,
  secondaryIndex: Index<IndexTagNames>,
  mapper: Mapper<Id, Src, IndexTagNames>
}) {
  return (src: Src) => {
    return JSON.stringify({
      ...args.mapper.computeIndexFields(src, args.primaryIndex),
      ...args.secondaryIndex && args.mapper.computeIndexFields(src, args.secondaryIndex)
    });
  }
}

type IndexQueryBuilderArgs<Id, Src, IndexTagNames = string> = {
  tableName: string
  mapper: Mapper<Id, Src, IndexTagNames>
  index: Index<IndexTagNames>
  builder?: QueryBuilder
  ddb?: DocumentClient;
}

export class IndexQueryBuilder<Id, Src, IndexTagNames = string> {
  tableName: string
  mapper: Mapper<Id, Src, IndexTagNames>
  
  index: Index<IndexTagNames>
  builder: QueryBuilder
  ddb?: DocumentClient;
  encodeCursor: (src: Src) => string;

  constructor(
    {tableName, mapper, builder, index, ddb}: IndexQueryBuilderArgs<Id, Src, IndexTagNames>
  ) {
    this.tableName = tableName;
    this.mapper = mapper;
    this.index = index;
    this.ddb = ddb;
    this.builder = (builder || new QueryBuilder()).table(tableName);

    this.encodeCursor = getCursorEncoder({
      secondaryIndex:index,
      primaryIndex: mapper.args.primaryIndex,
      mapper
    })

    if (isSecondaryIndex(index)) {
      this.builder = this.builder.index(index.indexName);
    }
  }

  clone(builder: QueryBuilder) {
    return new IndexQueryBuilder({
      tableName: this.tableName,
      mapper: this.mapper,
      index: this.index,
      ddb: this.ddb,
      builder
    })
  }

  limit(t: number) {
    return this.clone(this.builder.limit(t));
  }

  sort(direction: 'asc' | 'desc') {
    return this.clone(this.builder.sort(direction));
  }

  cursor(str: string) {
    return this.clone(this.builder.cursor(JSON.parse(str)));
  }

  build() {
    return this.builder.build();
  }

  async execute() {
    if (this.ddb) {
      let res = await this.ddb.query(this.builder.build() as any).promise() as (Omit<DocumentClient.QueryOutput, 'Items'> & {Items?: Src[]});
      return Object.assign(res, {encodeCursor: this.encodeCursor});
    } else {
      throw new Error('a document client instance must be provided to the constructor in order to execute queries')
    }
  }

  where(src: Partial<Src>) {
    let builder = this.builder;
    const indexes = this.mapper.computeIndexFields(src, this.index) as any;
    if (indexes[this.index.partitionKey]) {
      builder = builder.where(this.index.partitionKey as any, '=', indexes[this.index.partitionKey])
    }

    if (indexes[this.index.sortKey!]) {
      builder = builder.where(this.index.sortKey as any, 'BEGINS_WITH', indexes[this.index.sortKey!])
    }

    return this.clone(builder);
  }
}