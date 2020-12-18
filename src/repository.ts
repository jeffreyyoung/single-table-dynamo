import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import { BatchArgsHandler } from './batch-args-handler';
import { getCursorEncoder, IndexQueryBuilder } from './index-query-builder';
import { MapperArgs, Mapper } from './mapper';
import {getDDBUpdateExpression} from './utils/getDDBUpdateExpression';

type RepoArgs<ID, Src, IndexTagNames = string> = {
  tableName: string;
} & MapperArgs<ID, Src, IndexTagNames>;

export class Repository<ID, Src, IndexTagNames = string> {
  args: RepoArgs<ID, Src, IndexTagNames>;
  mapper: Mapper<ID, Src, IndexTagNames>;
  ddb: DocumentClient;
  batch: BatchArgsHandler<ID, Src, IndexTagNames>

  constructor(args: RepoArgs<ID, Src, IndexTagNames>, c: DocumentClient) {
    this.args = args;
    this.mapper = new Mapper<ID, Src, IndexTagNames>(args);
    this.ddb = c;
    this.batch = new BatchArgsHandler<ID, Src, IndexTagNames>(args.tableName, this.mapper);
  }

  async get(id: ID) {
    const res = await this.ddb
      .get({
        TableName: this.args.tableName,
        Key: this.getKey(id),
      })
      .promise();
    return res.Item as Src | undefined;
  }

  getKey(id: ID) {
    return this.mapper.getKey(id);
  }

  async updateUnsafe(id: ID, src: Partial<Src>, options: {upsert: boolean, returnValues?: 'ALL_NEW' | 'ALL_OLD'} = { upsert: false}) {
    
    const res = await this.ddb.update({
      TableName: this.args.tableName,
      Key: this.getKey(id),
      ...getDDBUpdateExpression(src, options.upsert ? [] : Object.keys(this.getKey(id))),
      ReturnValues: options?.returnValues ?? 'ALL_NEW',
    }).promise();
    return res.Attributes as Src | undefined;
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

  query(indexTag: IndexTagNames) {
    const builder = new IndexQueryBuilder(
      this.args.tableName,
      this._getIndexByTag(indexTag),
      this.mapper,
      this.ddb
    );
    return builder;
  }

  getCursorEncoder(indexTag: IndexTagNames) {
    return getCursorEncoder({
      secondaryIndex: this._getIndexByTag(indexTag),
      primaryIndex: this.args.primaryIndex,
      mapper: this.mapper
    });
  }

  _getIndexByTag(tag: IndexTagNames) {
    const index = this.mapper.indexes().find(i => i.tag === tag);
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

}
