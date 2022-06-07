import {
  FieldsToProject,
  getAllProjectableFields,
} from "./utils/ProjectFields";
import { GetRequest } from "./batch-get";
import { DeleteRequest, PutRequest } from "./batch-write";
import { Mapper } from "./mapper";
import { z } from "zod";

export class BatchArgsHandler<
  Id,
  Schema extends z.AnyZodObject,
  Input = z.input<Schema>,
  Output = z.output<Schema>
> {
  private mapper: Mapper<Schema>;
  private tableName: string;

  constructor(mapper: Mapper<Schema>) {
    this.tableName = mapper.args.tableName;
    this.mapper = mapper;
  }

  put(item: Input): PutRequest<Input> {
    return {
      TableName: this.tableName,
      Operation: {
        PutRequest: {
          Item: this.mapper.decorateWithKeys(this.mapper.parse(item)) as any,
        },
      },
    };
  }

  get(
    item: Id,
    extraArgs?: { fieldsToProject?: FieldsToProject<Output> }
  ): GetRequest<any> {
    return {
      TableName: this.tableName,
      Key: this.mapper.getKey(item as any),
      projectionFields:
        extraArgs?.fieldsToProject ||
        getAllProjectableFields(this.mapper.args as any),
    };
  }

  delete(key: Id): DeleteRequest {
    return {
      TableName: this.tableName,
      Operation: {
        DeleteRequest: {
          Key: this.mapper.getKey(key as any),
        },
      },
    };
  }
}
