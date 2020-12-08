import { AttributeRegistry } from './utils/AttributeRegistry'

type Operator = "<" | "<=" | "<>" | "=" | ">" | ">=" | "BETWEEN" | "IN" | "BEGINS_WITH"
type Where = {
  fieldName: string
  operator: Operator
  value: string | number
}

/**
 * Encapsulates all data needed to generate
 * query
 */
export type QueryData = {
  keyConditions: Where[]
  sortOrder: 'asc' | 'desc'
  limit: number
  indexName?: string
  tableName?: string
  /**
   * The key of the last fetched object
   */
  cursor?: object
}

export class QueryBuilder {
  data: QueryData
  constructor() {
    this.data = {
      keyConditions: [],
      sortOrder: 'desc',
      limit: 25
    }
  }

  table(tabeName: string) {
    this.data.tableName = tabeName;
    return this;
  }

  index(indexName: string) {
    this.data.indexName = indexName;
    return this;
  }

  sort(direction: 'asc' | 'desc') {
    this.data.sortOrder = direction;
    return this;
  }

  limit(l: number) {
    this.data.limit = l;
    return this;
  }

  cursor(l: object) {
    this.data.cursor = l;
    return this;
  }

  where(key: string, op: Operator, value: string | number) {
    this.data.keyConditions.push({
      fieldName: key,
      operator: op,
      value
    });
    return this;
  }

  build() {
    return {
      TableName: this.data.tableName,
      ScanIndexForeward: this.data.sortOrder === 'asc' ? true : false,
      Select: 'ALL_ATTRIBUTES',
      Limit: this.data.limit || 20,
      ...this.data.indexName && {IndexName: this.data.indexName},
      ...this._buildConditionExpression(),
      ...this._buildCursor()
    }
  }

  _buildConditionExpression() {
    const registry = new AttributeRegistry();
    const KeyConditionExpression: string[] = [];

    this.data.keyConditions.forEach((condition) => {
      if (condition.operator === 'BEGINS_WITH') {
        KeyConditionExpression.push(`begins_with(${registry.key(condition.fieldName)}, ${registry.value(condition.value)})`)
      } else {
        KeyConditionExpression.push(`${registry.key(condition.fieldName)} ${condition.operator} ${registry.value(condition.value)}`)
      }
      
    })
    return {
      ...registry.get(),
      KeyConditionExpression: KeyConditionExpression.join(' and ')
    }
  }

  _buildCursor() {
    if (this.data.cursor) {
      return {
        ExclusiveStartKey: this.data.cursor
      }
    }
    return {}
  }
}