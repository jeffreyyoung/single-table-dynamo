export class AttributeRegistry {
  attributeI = 0;
  valueI = 0;

  ExpressionAttributeNames = {};
  ExpressionAttributeValues = {};

  key(key: string) {
    const name= `#attr${this.attributeI}`;
    this.ExpressionAttributeNames[name] = key;
    this.attributeI+=1;
    return name;
  }

  value(value: any) {
    const attributeValueName= `:value${this.valueI}`;
    this.ExpressionAttributeValues[attributeValueName] = value;
    this.valueI+=1;
    return attributeValueName
  }

  get() {
    return {
      ExpressionAttributeNames: this.ExpressionAttributeNames,
      ExpressionAttributeValues: this.ExpressionAttributeValues,
    };
  }
}
