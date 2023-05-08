import { AttributeRegistry } from "./AttributeRegistry";

export function getDDBUpdateExpression<T>(item: T) {
  const registry = new AttributeRegistry();

  const UpdateExpression = `set ${Object.entries(item as any)
    .map(([key, value]) => {
      return `${registry.key(key)} = ${registry.value(value)}`;
    })
    .join(", ")}`;

  return {
    ...registry.get(),
    UpdateExpression,
  };
}
