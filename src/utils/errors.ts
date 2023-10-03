export function isSingleTableDynamoError(thing: any): thing is STDError {
  return thing?.name?.startsWith("single-table-") || false;
}

export class STDError extends Error {
  name:
    | "single-table-InputValidationError"
    | "single-table-OutputValidationError"
    | "single-table-IdValidationError"
    | "single-table-Error";

  meta?: Record<string, any>;
  constructor(options: {
    message: string;
    cause?: any;
    name:
      | "single-table-InputValidationError"
      | "single-table-OutputValidationError"
      | "single-table-IdValidationError"
      | "single-table-Error";
    meta?: Record<string, any>;
  }) {
    super(options.message, { cause: options.cause });

    this.name = options.name;
    this.meta = options.meta;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      meta: this.meta,
      cause: this.cause,
    };
  }
}
