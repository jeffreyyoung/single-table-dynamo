import { DocumentClient } from 'aws-sdk/clients/dynamodb'
import { IndexQueryBuilder } from './index-query-builder'
import { MapperArgs, Mapper } from './mapper'

type RepoArgs<Src> = {
  tableName: string
} & MapperArgs<Src>


export class Repository<ID, Src> {
  args: RepoArgs<Src>
  mapper: Mapper<Src>
  ddb: DocumentClient

  constructor(args: RepoArgs<Src>, c: DocumentClient) {
    this.args = args;
    this.mapper = new Mapper<Src>(args);
    this.ddb = c;
  }

  async get(id: ID){
    const res = await this.ddb.get({
      TableName: this.args.tableName,
      Key: id,
    }).promise();
    return res.Item as Src;
  }
  async put(src: Src){
    await this.ddb.put({
      TableName: this.args.tableName,
      Item: this.mapper.decorateWithIndexedFields(src)
    }).promise()
    return src;
  }
  async delete(id: ID){
    await this.ddb.delete({
      TableName: this.args.tableName,
      Key: id
    }).promise()
    return true;
  }
  query(indexTag: string) {
    const builder = new IndexQueryBuilder(
      this.args.tableName,
      this.indexByTag(indexTag),
      this.mapper,
      this.ddb
    );
    return builder
  }
  indexByTag(tag: string) {
    const index = this.args.indexes.find(i => i.tag === tag)
    if (!index) {
      throw new Error(`No index exists for that tag, tag: ${tag}, args: ${JSON.stringify(this.args, null, 3)}`)
    }
    return index;
  }
}