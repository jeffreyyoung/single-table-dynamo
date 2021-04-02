import { FieldsToProject, getDefaultFieldsToProject } from './utils/ProjectFields';
import { GetRequest } from './batch-get';
import { DeleteRequest, PutRequest } from './batch-write';
import { Mapper } from './mapper';

export class BatchArgsHandler<Id, T> {
  private mapper: Mapper<T>
  private tableName: string

  constructor(mapper: Mapper<T>) {
    this.tableName = mapper.args.tableName;
    this.mapper = mapper;
  }

  put(item: T): PutRequest<T> {
    return {
      TableName: this.tableName,
      Operation: {
        PutRequest: {
          Item: this.mapper.decorateWithKeys(this.mapper.assert(item)) as any
        }
      }
    }
  }

  get(item: Id, extraArgs?: { fieldsToProject?: FieldsToProject<T> }): GetRequest<any> {
    return {
      TableName: this.tableName,
      Key: this.mapper.getKey(item as any),
      projectionFields: extraArgs?.fieldsToProject || getDefaultFieldsToProject(this.mapper.args as any)
    }
  }

  delete(key: Id): DeleteRequest {
    return {
      TableName: this.tableName,
      Operation: {
        DeleteRequest: {
          Key: this.mapper.getKey(key as any)
        }
      }
    }
  }
}