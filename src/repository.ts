import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import { IndexBase, IndexField, Mapper, RepositoryArgs } from './mapper';
import { getCursorEncoder, IndexQueryBuilder } from './index-query-builder';
import {getDDBUpdateExpression} from './utils/getDDBUpdateExpression';
import { BatchArgsHandler } from './batch-args-handler';

export class Repository<
  Src = any,
  PrimaryKeyField extends IndexField<Src> = IndexField<Src>,
  IndexTag extends string = string,
  SecondaryIndexTag extends string = string,
  ID = Pick<Src, PrimaryKeyField>,
  NotFoundType = undefined
> {
  args: RepositoryArgs<Src, PrimaryKeyField, IndexTag, SecondaryIndexTag, NotFoundType>
  mapper: Mapper<Src, PrimaryKeyField, IndexTag, SecondaryIndexTag, ID, NotFoundType>
  batch: BatchArgsHandler<ID, Src>
  ddb: DocumentClient
  
  constructor(args: RepositoryArgs<Src, PrimaryKeyField, IndexTag, SecondaryIndexTag, NotFoundType>, ddb: DocumentClient) {
    this.args = args;
    this.mapper = new Mapper(args);
    this.batch = new BatchArgsHandler<ID, Src>(this.mapper as any);
    this.ddb = ddb;
  }

  async get(id: ID): Promise<Src | NotFoundType> {
    const res = await this.ddb
      .get({
        TableName: this.args.tableName,
        Key: this.mapper.getKey(id),
      })
      .promise();
    return res.Item as Src || this.args.NotFoundType as any;
  }

  getKey(id: ID) {
    return this.mapper.getKey(id);
  }

  async updateUnsafe(id: ID, src: Partial<Src>, options: {upsert: boolean, returnValues?: 'ALL_NEW' | 'ALL_OLD'} = { upsert: false}) {
    
    const updates = this.mapper.partialAssert(src);    

    const res = await this.ddb.update({
      TableName: this.args.tableName,
      Key: this.mapper.getKey(id),
      ...getDDBUpdateExpression(updates, options.upsert ? [] : Object.keys(this.mapper.getKey(id))),
      ReturnValues: options?.returnValues ?? 'ALL_NEW',
    }).promise();
    return res.Attributes as Src || this.args.NotFoundType;
  }

  async put(src: Src) {
    const masked = this.mapper.assert(src);
    await this.ddb
      .put({
        TableName: this.args.tableName,
        Item: this.mapper.decorateWithKeys(masked),
      })
      .promise();

    return masked;
  }

  async delete(id: ID) {
    await this.ddb
      .delete({
        TableName: this.args.tableName,
        Key: this.mapper.getKey(id),
      })
      .promise();
    return true;
  }
  getIndexByTag(indexTag: IndexTag | SecondaryIndexTag): IndexBase<Src> {
    let index;
    if (this.args.secondaryIndexes?.[indexTag as SecondaryIndexTag]) {
      index = this.args.secondaryIndexes[indexTag as SecondaryIndexTag];
    } else if (this.args.primaryIndex.tag === indexTag) {
      index = this.args.primaryIndex;
    }
    if (!index) {
      throw new Error('expected an index, but did not get one');
    }
    return index;
  }

  query(indexTag: IndexTag | SecondaryIndexTag) {
    
    const builder = new IndexQueryBuilder<Src>({
      tableName: this.args.tableName,
      index: this.getIndexByTag(indexTag),
      mapper: this.mapper as any,
      ddb: this.ddb
    });
    return builder;
  }

  getCursorEncoder(indexTag: IndexTag | SecondaryIndexTag) {
    return getCursorEncoder({
      secondaryIndex: this.getIndexByTag(indexTag),
      primaryIndex: this.args.primaryIndex,
      mapper: this.mapper as any
    });
  }
}


export type InferObjectType<Repo> = Repo extends Repository<infer T, any> ? T : never;
export type InferIdType<Repo> = Repo extends Repository<infer T, infer IdField> ? Pick<T, IdField> : never;
