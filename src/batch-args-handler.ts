import { GetRequest } from 'batch-get';
import { WriteRequest } from './batch-write';
import { Mapper } from './mapper';

export class BatchArgsHandler<Id, T> {
  private mapper: Mapper<Id, T>
  private tableName: string

  constructor(tableName: string, mapper: Mapper<Id, T>) {
    this.tableName = tableName;
    this.mapper = mapper;
  }

  get(item: Id): GetRequest {
    return {
      TableName: this.tableName,
      Key: this.mapper.getKey(item),
    }
  }  

  put(item: T): WriteRequest {
    return {
      TableName: this.tableName,
      Operation: {
        PutRequest: {
          Item: this.mapper.decorateWithIndexedFields(item)
        }
      }
    }
  }

  delete(key: Id): WriteRequest {
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