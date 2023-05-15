export class AttributeRegistry {
  attributeI = 0;
  valueI = 0;

  namesMap: Map<string, string> = new Map();
  valuesMap: Map<any, string> = new Map();

  key(key: string) {
    if (!this.namesMap.has(key)) {
      const name = `#attr${this.attributeI}`;
      this.namesMap.set(key, name);
      this.attributeI += 1;
    }

    return this.namesMap.get(key);
  }

  value(value: any) {
    if (!this.valuesMap.has(value)) {
      const name = `:value${this.valueI}`;
      this.valuesMap.set(value, name);
      this.valueI += 1;
    }
    return this.valuesMap.get(value);
  }

  private mapToObject(thing: Map<any, string>) {
    const entries = thing.entries();
    const arr = Array.from(entries);
    const obj = Object.fromEntries(arr.map(([key, value]) => [value, key]));
    return obj;
  }

  get() {
    return {
      ExpressionAttributeNames: this.mapToObject(this.namesMap),
      ExpressionAttributeValues: this.mapToObject(this.valuesMap),
    };
  }
}
