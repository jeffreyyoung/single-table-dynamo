export type FieldsToProject<T = any> = (string & keyof T)[]

export function getDefaultFieldsToProject<Src>(args: any): FieldsToProject<Src> {
  return Object.keys(args.schema.schema as any) as any;
}

export function toProjectionExpression(fields: FieldsToProject) {
  if (fields.length === 0) {
    return {};
  }
  const ExpressionAttributeNames: Record<string, string> = {};
  let i = 0;
  (new Set(fields)).forEach((f) => {
    ExpressionAttributeNames[`#c${i++}`] = f;
  })
  return {
    ExpressionAttributeNames,
    ProjectionExpression: Object.keys(ExpressionAttributeNames).join(', ')
  }
}