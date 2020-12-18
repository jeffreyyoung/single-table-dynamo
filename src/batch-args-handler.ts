import { GetRequest } from 'batch-get';
import { DeleteRequest, PutRequest } from './batch-write';
import { Mapper } from './mapper';

export class BatchArgsHandler<Id, T, IndexTagNames = string> {
  private mapper: Mapper<Id, T, IndexTagNames>
  private tableName: string

  constructor(tableName: string, mapper: Mapper<Id, T, IndexTagNames>) {
    this.tableName = tableName;
    this.mapper = mapper;
  }

  put(item: T): PutRequest<T> {
    return {
      TableName: this.tableName,
      Operation: {
        PutRequest: {
          Item: this.mapper.decorateWithIndexedFields(item)
        }
      }
    }
  }

  get(item: Id): GetRequest<T> {
    return {
      TableName: this.tableName,
      Key: this.mapper.getKey(item),
    }
  }

  delete(key: Id): DeleteRequest {
    return {
      TableName: this.tableName,
      Operation: {
        DeleteRequest: {
          Key: this.mapper.getKey(key)
        }
      }
    }
  }
}