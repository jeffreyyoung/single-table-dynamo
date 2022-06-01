export function isSingleTableDynamoError(thing: any): thing is STDError {
  return thing?.name?.startsWith("single-table-") || false;
}
export interface STDError extends Error {
  message: string;
  cause?: Error;
  name:
    | "single-table-InputValidationError"
    | "single-table-OutputValidationError"
    | "single-table-IdValidationError"
    | "single-table-Error";
}

export function createSTDError(args: {
  message: string;
  cause?: Error;
  name:
    | "single-table-InputValidationError"
    | "single-table-OutputValidationError"
    | "single-table-IdValidationError"
    | "single-table-Error";
}) {
  const error = new CausedError(args.message, { cause: args.cause });
  error.name = args.name;
  return error;
}

class CausedError extends Error {
  cause?: Error;
  constructor(message: string, options: { cause?: Error } = {}) {
    super(message);
    if (options.cause) {
      const cause = options.cause;
      this.cause = cause;
      if (cause.stack) {
        this.stack = this.stack + "\nCAUSE: " + cause.stack;
      }
    }
  }
}
