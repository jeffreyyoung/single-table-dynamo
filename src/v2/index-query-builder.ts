import { isPrimaryIndex, Mapper, SingleTableIndex } from "./mapper";
import { QueryBuilder } from './query-builder';

export class IndexQueryBuilder<Src> {
  mapper: Mapper<Src>
  builder: QueryBuilder
  index: SingleTableIndex<Src>

  constructor(tableName: string, index: SingleTableIndex<Src>, mapper: Mapper<Src>) {
    this.mapper = mapper;
    this.index = index;
    this.builder = new QueryBuilder();
    this.builder
      .table(tableName)
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

  where(src: Partial<Src>) {
    const indexes = this.mapper.computeIndexFields(src, this.index) as any;
    if (indexes[this.index.partitionKey]) {
      this.builder.where(this.index.partitionKey as any, 'EQ', indexes[this.index.partitionKey])
    }

    if (indexes[this.index.sortKey]) {
      this.builder.where(this.index.sortKey as any, 'BEGINS_WITH', indexes[this.index.sortKey])
    }

    return this;
  }
}