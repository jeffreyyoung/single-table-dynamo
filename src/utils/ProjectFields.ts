import type { toZod } from "tozod";

export type FieldsToProject<T = any> = (keyof T & string)[];

export function getAllProjectableFields<Src>(args: {
  schema: any;
}): FieldsToProject<Src> {
  // horid hack but it is what it is 🤷‍♂️
  let schema: toZod<{ meow: boolean }> = args.schema as any;

  return Object.keys(schema._def.shape()) as any;
}

export function toProjectionExpression(fields: FieldsToProject) {
  if (fields.length === 0) {
    return {};
  }
  const ExpressionAttributeNames: Record<string, string> = {};
  let i = 0;
  new Set(fields).forEach((f) => {
    ExpressionAttributeNames[`#c${i++}`] = f;
  });
  return {
    ExpressionAttributeNames,
    ProjectionExpression: Object.keys(ExpressionAttributeNames).join(", "),
  };
}
