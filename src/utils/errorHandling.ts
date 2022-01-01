import type { Repository } from "../repository";

type MethodName = keyof Repository | "parse" | "partialParse" | "parseId";
class SingleTableDynamoError extends Error {
  __stddbError = true;
  type: "input-validation" | "ouput-validation" | "id-validation" | "other";
  entityTypeName: string;
  methodsTrace: MethodName[];
  originalError: any;
  constructor(args: SingleTableDynamoErrorArgs) {
    super(args.message);
    this.type = args.type;
    this.entityTypeName = args.entityTypeName;
    this.methodsTrace = args.methodsTrace;
    this.originalError = args.originalError;
  }

  get method() {
    if (this.methodsTrace.length > 0) {
      return this.methodsTrace[0];
    }
  }
}
type SingleTableDynamoErrorArgs = {
  type: "input-validation" | "ouput-validation" | "id-validation" | "other";
  entityTypeName: string;
  methodsTrace: MethodName[];
  originalError: any;
  message?: string;
};

export function isSingleTableDynamoError(
  thing: any
): thing is SingleTableDynamoError {
  return thing?.__stddbError === true;
}

export function createSTDDBError({
  error,
  ...args
}: Omit<SingleTableDynamoErrorArgs, "originalError"> & {
  error: any;
}): SingleTableDynamoError {
  return new SingleTableDynamoError({
    ...args,
    originalError: error,
  });
}

export function handleError(
  error: any,
  methodName: keyof Repository,
  entityTypeName: string
) {
  if (isSingleTableDynamoError(error)) {
    error.methodsTrace.unshift(methodName);
    throw error;
  } else {
    throw createSTDDBError({
      error,
      type: "other",
      methodsTrace: [methodName],
      entityTypeName,
    });
  }
}
