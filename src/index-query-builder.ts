import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import { Mapper, Index, isSecondaryIndex } from "./mapper";
import { QueryBuilder } from './query-builder';

export function getCursorEncoder<Id, Src>(args: {
  primaryIndex: Index,
  secondaryIndex: Index,
  mapper: Mapper<Id, Src>
}) {
  return (src: Src) => {
    return JSON.stringify({
      ...args.mapper.computeIndexFields(src, args.primaryIndex),
      ...args.secondaryIndex && args.mapper.computeIndexFields(src, args.secondaryIndex)
    });
  }
}

export class IndexQueryBuilder<Id, Src> {
  mapper: Mapper<Id, Src>
  builder: QueryBuilder
  index: Index
  ddb?: DocumentClient;
  encodeCursor: (src: Src) => string;

  constructor(
    tableName: string,
    index: Index,
    mapper: Mapper<Id, Src>,
    ddb?: DocumentClient,
  ) {
    
    this.mapper = mapper;
    this.index = index;
    this.ddb = ddb;
    this.builder = new QueryBuilder();
    this.builder
      .table(tableName)

    this.encodeCursor = getCursorEncoder({
      secondaryIndex:index,
      primaryIndex: mapper.args.primaryIndex,
      mapper
    })

    if (isSecondaryIndex(index)) {
      this.builder.index(index.indexName);
    }
  }

  limit(t: number) {
    this.builder.limit(t);
    return this;
  }

  sort(direction: 'asc' | 'desc') {
    this.builder.sort(direction);
    return this;
  }

  cursor(str: string) {
    this.builder.cursor(JSON.parse(str));
    return this;
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
    const indexes = this.mapper.computeIndexFields(src, this.index) as any;
    if (indexes[this.index.partitionKey]) {
      this.builder.where(this.index.partitionKey as any, '=', indexes[this.index.partitionKey])
    }

    if (indexes[this.index.sortKey!]) {
      this.builder.where(this.index.sortKey as any, 'BEGINS_WITH', indexes[this.index.sortKey!])
    }

    return this;
  }
}