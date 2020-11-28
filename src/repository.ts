import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import { getCursorEncoder, IndexQueryBuilder } from './index-query-builder';
import { MapperArgs, Mapper, isPrimaryIndex } from './mapper';
import {getDDBUpdateExpression} from './utils/getDDBUpdateExpression';

type RepoArgs<Src> = {
  tableName: string;
} & MapperArgs<Src>;

export class Repository<ID, Src> {
  args: RepoArgs<Src>;
  mapper: Mapper<Src>;
  ddb: DocumentClient;

  constructor(args: RepoArgs<Src>, c: DocumentClient) {
    this.args = args;
    this.mapper = new Mapper<Src>(args);
    this.ddb = c;
  }

  async get(id: ID) {
    const res = await this.ddb
      .get({
        TableName: this.args.tableName,
        Key: this.getKey(id),
      })
      .promise();
    return res.Item as Src;
  }

  getKey(id: ID) {
    return this.mapper.computeIndexFields(id, this._getPrimaryIndex());
  }

  async updateUnsafe(id: ID, src: Partial<Src>) {
    
    return this.ddb.update({
      TableName: this.args.tableName,
      Key: this.getKey(id),
      ...getDDBUpdateExpression(src),
      ReturnValues: 'ALL_NEW',
    }).promise();
  }

  async put(src: Src) {
    await this.ddb
      .put({
        TableName: this.args.tableName,
        Item: this.mapper.decorateWithIndexedFields(src),
      })
      .promise();

    return src;
  }
  async delete(id: ID) {
    await this.ddb
      .delete({
        TableName: this.args.tableName,
        Key: this.getKey(id),
      })
      .promise();
    return true;
  }
  query(indexTag: string) {
    const builder = new IndexQueryBuilder(
      this.args.tableName,
      this._getIndexByTag(indexTag),
      this.mapper,
      this.ddb
    );
    return builder;
  }
  getCursorEncoder(indexTag: string) {
    return getCursorEncoder(
      this._getIndexByTag(indexTag),
      this._getPrimaryIndex(),
      this.mapper
    );
  }
  _getIndexByTag(tag: string) {
    const index = this.args.indexes.find(i => i.tag === tag);
    if (!index) {
      throw new Error(
        `No index exists for that tag, tag: ${tag}, args: ${JSON.stringify(
          this.args,
          null,
          3
        )}`
      );
    }
    return index;
  }
  _getPrimaryIndex() {
    const index = this.args.indexes.find(i => isPrimaryIndex(i));
    if (!index) {
      throw new Error(
        `No primary index has been defined, args: ${JSON.stringify(
          this.args,
          null,
          3
        )}`
      );
    }
    return index;
  }
}
