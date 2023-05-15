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

  put(item: Input): PutRequest<Output> {
    const result = this.mapper.parse(item);

    return {
      TableName: this.tableName,
      Operation: {
        PutRequest: {
          Item: this.mapper.decorateWithKeys(result) as any,
          Key: this.mapper.getKey(result),
        },
      },
    };
  }

  get(item: Id): GetRequest<any> {
    return {
      TableName: this.tableName,
      Key: this.mapper.getKey(item as any),
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
