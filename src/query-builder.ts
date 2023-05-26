import { AttributeRegistry } from "./utils/AttributeRegistry";

export type Operator =
  | "<"
  | "<="
  | "<>"
  | "="
  | ">"
  | ">="
  | "BETWEEN"
  | "IN"
  | "BEGINS_WITH";
type Where = {
  fieldName: string;
  operator: Operator;
  value: string | number;
};

/**
 * Encapsulates all data needed to generate
 * query
 */
export type QueryData = {
  keyConditions: Where[];
  filterExpression: Where[];
  sortDirection: "asc" | "desc";
  limit: number;
  indexName?: string;
  tableName?: string;
  /**
   * The key of the last fetched object
   */
  cursor?: object;
};

export class QueryBuilder {
  data: QueryData;
  constructor(data?: QueryData) {
    this.data = data || {
      keyConditions: [],
      filterExpression: [],
      sortDirection: "asc",
      limit: 25,
    };
  }

  cloneWith(data: Partial<QueryData> = {}) {
    return new QueryBuilder({
      ...this.data,
      ...data,
    });
  }

  table(tableName: string) {
    return this.cloneWith({ tableName });
  }

  index(indexName: string) {
    return this.cloneWith({ indexName });
  }

  sort(direction: "asc" | "desc") {
    return this.cloneWith({ sortDirection: direction });
  }

  limit(limit: number) {
    return this.cloneWith({ limit });
  }

  cursor(cursor: object) {
    return this.cloneWith({ cursor });
  }

  where(key: string, op: Operator, value: string | number) {
    const keyConditions = [
      ...this.data.keyConditions,
      {
        fieldName: key,
        operator: op,
        value,
      },
    ];
    return this.cloneWith({ keyConditions });
  }

  filter(key: string, op: Operator, value: string | number) {
    const filterExpression = [
      ...this.data.filterExpression,
      {
        fieldName: key,
        operator: op,
        value,
      },
    ];
    return this.cloneWith({ filterExpression });
  }

  build() {
    const registry = new AttributeRegistry();
    return {
      TableName: this.data.tableName,
      ScanIndexForward: this.data.sortDirection === "asc",
      Limit: this.data.limit || 20,
      ...(this.data.indexName && { IndexName: this.data.indexName }),
      ...this._buildConditionExpression(registry),
      ...this._buildCursor(),
      ...this._buildFilterExpression(registry),
      ...registry.get(),
    };
  }

  _buildFilterExpression(attrs: AttributeRegistry): {
    FilterExpression?: string;
  } {
    const FilterExpression: string[] = [];

    if (this.data.filterExpression.length === 0) {
      return {};
    }
    for (const filter of this.data.filterExpression) {
      if (filter.operator === "BEGINS_WITH") {
        FilterExpression.push(
          `begins_with(${attrs.key(filter.fieldName)}, ${attrs.value(
            filter.value
          )})`
        );
      } else {
        FilterExpression.push(
          `${attrs.key(filter.fieldName)} ${filter.operator} ${attrs.value(
            filter.value
          )}`
        );
      }
    }

    return {
      FilterExpression: FilterExpression.join(" and "),
    };
  }

  _buildConditionExpression(registry: AttributeRegistry) {
    const KeyConditionExpression: string[] = [];
    this.data.keyConditions.forEach((condition) => {
      if (condition.operator === "BEGINS_WITH") {
        KeyConditionExpression.push(
          `begins_with(${registry.key(condition.fieldName)}, ${registry.value(
            condition.value
          )})`
        );
      } else {
        KeyConditionExpression.push(
          `${registry.key(condition.fieldName)} ${
            condition.operator
          } ${registry.value(condition.value)}`
        );
      }
    });
    return {
      KeyConditionExpression: KeyConditionExpression.join(" and "),
    };
  }

  _buildCursor() {
    if (this.data.cursor) {
      return {
        ExclusiveStartKey: this.data.cursor,
      };
    }
    return {};
  }
}
