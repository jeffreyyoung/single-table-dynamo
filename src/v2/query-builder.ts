type Operator = "EQ" | "NE" | "IN" | "LE" | "LT" | "GE" | "GT" | "BETWEEN" | "NOT_NULL" | "NULL" | "CONTAINS" | "NOT_CONTAINS" | "BEGINS_WITH"
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
      ...this.data.indexName && {IndexName: this.data.indexName},
      ...this._buildConditionExpression(),
      ...this._buildCursor()
    }
  }

  _buildConditionExpression() {
    const ExpressionAttributeNames = {};
    const KeyConditionExpression: string[] = [];
    const ExpressionAttributeValues = {};

    this.data.keyConditions.forEach((condition, i) => {
      const attributeName = 'attr'+i;
      ExpressionAttributeNames[`#${attributeName}`] = condition.fieldName;
      ExpressionAttributeValues[`:${attributeName}`] = condition.value;
      KeyConditionExpression.push(`#${attributeName} ${condition.operator} :${attributeName}`)
    })
    return {
      ExpressionAttributeNames,
      ExpressionAttributeValues,
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