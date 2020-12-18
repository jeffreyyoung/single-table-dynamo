import { takeWhile } from './utils/takeWhile';

export type KeysOfType<T, TProp> = { [P in keyof T]: T[P] extends TProp? P : never }[keyof T];

export enum IndexType {
  Primary = 'Primary',
  Secondary = 'Secondary'
}

export type PrimaryIndex<ID, IndexTagNames = string> = Index<IndexTagNames> | (CompositeIndex<ID, IndexTagNames>)

export type SecondaryIndex<Src, IndexTagNames = string> = NamedIndex<IndexTagNames> | (NamedIndex<IndexTagNames> & CompositeIndex<Src, IndexTagNames>);

export function isSecondaryIndex<Src, IndexTagNames>(i: Index<IndexTagNames>): i is SecondaryIndex<Src, IndexTagNames> {
  let namedIndex = i as SecondaryIndex<Src>;
  if (namedIndex.indexName) {
    return true;
  }

  return false;
}

type NamedIndex<IndexTagNames = string> = Index<IndexTagNames> & { indexName: string };

export type Index<IndexTagNames = string> = {
  tag?: IndexTagNames
  partitionKey: string
  sortKey?: string
};

type CompositeKeyField<Src> = (KeysOfType<Src, string> | NonStringField<Src>);

export type CompositeIndex<Src, IndexTagNames = string> = {
  fields: CompositeKeyField<Src>[]
} & Index<IndexTagNames>;

interface NonStringField<Src> {
  toString: (s: Src) => string
  fields: Extract<keyof Src, string>[]
}


export type MapperArgs<Id, Src, IndexTagNames = string> = {
  typeName: string,
  indexFieldSeparator?: string,
  primaryIndex: PrimaryIndex<Id, IndexTagNames>,
  secondaryIndexes?: SecondaryIndex<Src, IndexTagNames>[]
}



function isNonStringField<T>(thing: any): thing is NonStringField<T> {
  return thing?.fields && thing?.toString;
}

/**
 * The mapper is what has the responsibility of decorating
 * a 
 * @param args 
 */
export class Mapper<Id, Src, IndexTagNames = string> {
  readonly args: MapperArgs<Id, Src, IndexTagNames>

  constructor(args: MapperArgs<Id, Src, IndexTagNames>) {
    this.args = args;
  }

  getKey(id: Id) {
    return this.computeIndexFields(id, this.args.primaryIndex);
  }

  indexes() {
    return [this.args.primaryIndex, ...(this.args.secondaryIndexes || [])];
  }
  /**
   * Takes an object to be saved to ddb,
   * and adds any computed index fields to it
   * @param src 
   */
  decorateWithIndexedFields(src: Src) {
    const res = {...src};

    this.indexes().forEach((i: Index<IndexTagNames>) => {
      Object.assign(res, this.computeIndexFields(src, i));
    });
    return res;
  }

  stringifyField(src: Partial<Src>, f: CompositeKeyField<Src>) {
    if (isNonStringField(f)) {
      return f.toString(src);
    } else {
      return src[f as string];
    }
  }

  _isCompositeIndex(index: Index<IndexTagNames>): index is CompositeIndex<Src, IndexTagNames> {
    return 'fields' in index;
  }

  _computeCompositePrimaryKey(src: Partial<Src>, primaryField: CompositeIndex<Src>['fields'][number]) {
    const field = this.stringifyField(src, primaryField);
    if (!field) {
      throw new Error(`You must provide partition key fields, required field: ${primaryField}, provided fields: ${JSON.stringify(src, null, 1)}`)
    }
    return [this.args.typeName, this.stringifyField(src, primaryField)].join('#');
  }

  _computeCompositeSortKey(src: Partial<Src>, sortKeyFields: CompositeIndex<Src>['fields']) {
    return [this.args.typeName, ...sortKeyFields.map(f => this.stringifyField(src, f))].join('#')
  }

  _isInSrc(src: Partial<Src>, indexField: CompositeIndex<Src>['fields'][number]) {
    let fields = [];
    if (isNonStringField(indexField)) {
      fields = [...indexField.fields]
    } else {
      fields = [indexField]
    };
    return fields.every(f=> (src as any).hasOwnProperty(f))
  }

  /**
   * Returns the key/values of an index
   * @param src 
   * @param typeName 
   * @param index 
   */
  computeIndexFields(src: Partial<Src>, index: Index<IndexTagNames>) {
    if (this._isCompositeIndex(index)) {
      if (index.fields.length < 1) {
        throw new Error(`A partition key field must be provided:\n\nprovided fields: ${JSON.stringify(src,null,1)}\nindex: ${JSON.stringify(index,null,1)}`)
      }

      const partitionValue = this._computeCompositePrimaryKey(src, index.fields[0]);

      const sortValue = this._computeCompositeSortKey(src, takeWhile(
          index.fields.slice(1),
          (f) => !this._isInSrc(src, f)
        ));

      return {
        ...partitionValue && {[index.partitionKey]: partitionValue},
        ...sortValue && index.sortKey && {[index.sortKey]: sortValue}
      }
    } else {
      return {
        [index.partitionKey]: src[index.partitionKey],
        ...index.sortKey && src[index.sortKey] && {[index.sortKey]: src[index.sortKey]}
      }
    }
  }
}
