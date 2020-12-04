import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import { isPrimaryIndex, Mapper, SingleTableIndex } from "./mapper";
import { QueryBuilder } from './query-builder';

export function getCursorEncoder<Src>(index: SingleTableIndex<Src>, primaryIndex: SingleTableIndex<Src>, mapper: Mapper<Src>) {
  return (src: Src) => {
    return JSON.stringify({
      ...mapper.computeIndexFields(src, index),
      ...mapper.computeIndexFields(src, primaryIndex)
    });
  }
}

export class IndexQueryBuilder<Src> {
  mapper: Mapper<Src>
  builder: QueryBuilder
  index: SingleTableIndex<Src>
  ddb?: DocumentClient;
  encodeCursor: (src: Src) => string;

  constructor(
    tableName: string,
    index: SingleTableIndex<Src>,
    mapper: Mapper<Src>,
    ddb?: DocumentClient,
    encodeCursor?: (src: Src) => string,
  ) {
    
    this.mapper = mapper;
    this.index = index;
    this.ddb = ddb;
    this.builder = new QueryBuilder();
    this.builder
      .table(tableName)

    const defaultEncoder = (src: Src) => JSON.stringify(this.mapper.computeIndexFields(src, index));
    this.encodeCursor = encodeCursor || defaultEncoder;
    if (!isPrimaryIndex(index)) {
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

  cursor(str: 'string') {
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