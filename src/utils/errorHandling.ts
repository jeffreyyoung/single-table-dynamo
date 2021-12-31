import type { Repository } from "../repository";

type MethodName = keyof Repository | "parse" | "partialParse" | "parseId";

type SingleTableDynamoError = {
  __stddbError: true;
  type: "input-validation" | "ouput-validation" | "id-validation" | "other";
  entityTypeName: string;
  get method(): MethodName;
  methodsTrace: MethodName[];
  originalError: any;
};

export function isSingleTableDynamoError(
  thing: any
): thing is SingleTableDynamoError {
  return thing?.__stddbError === true;
}

export function createSTDDBError({
  error,
  ...args
}: Omit<SingleTableDynamoError, "__stddbError" | "originalError" | "method"> & {
  error: any;
}): SingleTableDynamoError {
  return {
    __stddbError: true,
    ...args,
    get method() {
      return args.methodsTrace[0];
    },
    originalError: error,
  };
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
