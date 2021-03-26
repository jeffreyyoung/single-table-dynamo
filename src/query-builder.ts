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
  sortDirection: 'asc' | 'desc'
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
  constructor(data?: QueryData) {
    this.data = data || {
      keyConditions: [],
      sortDirection: 'asc',
      limit: 25
    }
  }

  cloneWith(data: Partial<QueryData>) {
    return new QueryBuilder({
      ...this.data,
      ...data
    })
  }

  table(tableName: string) {
    return this.cloneWith({tableName})
  }

  index(indexName: string) {
    return this.cloneWith({indexName});
  }

  sort(direction: 'asc' | 'desc') {
    return this.cloneWith({sortDirection: direction});
  }

  limit(limit: number) {
    return this.cloneWith({limit})
  }

  cursor(cursor: object) {
    return this.cloneWith({cursor})
  }

  where(key: string, op: Operator, value: string | number) {
    const keyConditions = [...this.data.keyConditions, {
      fieldName: key,
      operator: op,
      value
    }]
    return this.cloneWith({keyConditions})
  }

  build() {
    return {
      TableName: this.data.tableName,
      ScanIndexForward: this.data.sortDirection === 'asc',
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