export function getDDBUpdateExpression<T>(item: T) {
  const ExpressionAttributeValues = {};
  const ExpressionAttributeNames = {};

  const UpdateExpression = `set ${Object.keys(item).map((key, i) => {

    const attribute= key;
    const attributeName= `#attribute_${i}`;
    const attributeValue= item[key];
    const attributeValueName= `:attribute_${i}`;

    ExpressionAttributeNames[attributeName] = attribute;
    ExpressionAttributeValues[attributeValueName] = attributeValue;

    return `${attributeName} = ${attributeValueName}`;
  }).join(', ')}`;

  return {
    ExpressionAttributeValues,
    ExpressionAttributeNames,
    UpdateExpression
  }
}