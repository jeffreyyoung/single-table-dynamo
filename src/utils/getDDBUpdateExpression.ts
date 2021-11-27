import { AttributeRegistry } from './AttributeRegistry';


export function getDDBUpdateExpression<T>(item: T, mustExistFields: string[]) {
  const registry = new AttributeRegistry();

  const UpdateExpression = `set ${Object.entries(item).map(([key, value]) => {
    return `${registry.key(key)} = ${registry.value(value)}`;
  }).join(', ')}`;
  let ConditionExpression = undefined;

  if (mustExistFields.length > 0) {
    ConditionExpression = mustExistFields.map(attribute => {
      return `attribute_exists(${registry.key(attribute)})`;
    }).join(' and ')
  }

  return {
    ...registry.get(),
    UpdateExpression,
    ConditionExpression
  }
}