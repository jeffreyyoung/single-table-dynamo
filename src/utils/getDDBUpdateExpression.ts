import { AttributeRegistry } from './AttributeRegistry';


export function getDDBUpdateExpression<T>(item: T, mustExistFields: string[]) {
  const registry = new AttributeRegistry();

  const UpdateExpression = `set ${Object.keys(item).map((key) => {
    return `${registry.key(key)} = ${registry.value(item[key])}`;
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