export function omit<T extends Record<string, any>>(
  obj: T,
  fieldsToOmit: string[]
): T {
  const newObj = { ...obj };
  for (const field of fieldsToOmit) {
    delete newObj[field];
  }
  return newObj;
}
