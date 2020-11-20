import { takeWhile } from './utils/takeWhile';

export type KeysOfType<T, TProp> = { [P in keyof T]: T[P] extends TProp? P : never }[keyof T];

export enum IndexType {
  Primary = 'Primary',
  Secondary = 'Secondary'
}

type PrimaryIndex = {
  type?: IndexType.Primary
}

type SecondaryIndex = {
  type?: IndexType.Secondary
  indexName: string
}

export type IndexBase = (PrimaryIndex | SecondaryIndex) & {tag: string};

export type Index = {
  partitionKey: string
  sortKey?: string
} & IndexBase;

export type CompositeIndex<Src> = {
  fields: (KeysOfType<Src, string> | NonStringField<Src>)[]
} & Index;

export type SingleTableIndex<Src> = Index | CompositeIndex<Src>

interface NonStringField<Src> {
  toString: (s: Src) => string
  fields: Extract<keyof Src, string>[]
}


export type MapperArgs<Src> = {
  typeName: string,
  indexFieldSeparator?: string,
  indexes: (SingleTableIndex<Src>)[]
}

function isNonStringField<T>(thing: any): thing is NonStringField<T> {
  return thing?.fields && thing?.toString;
}

export function isPrimaryIndex(thing: any): thing is PrimaryIndex {
  //if it doesnt have a indexName, we assume it's the primary
  return !Boolean((thing as SecondaryIndex).indexName);
}


/**
 * The mapper is what has the responsibility of decorating
 * a 
 * @param args 
 */
export class Mapper<Src> {
  args: MapperArgs<Src>

  constructor(args: MapperArgs<Src>) {
    this.args = args;
  }

  /**
   * Takes an object to be saved to ddb,
   * and adds any computed index fields to it
   * @param src 
   */
  decorateWithIndexedFields(src: Src) {
    const res = {...src};
    this.args.indexes.forEach(i => {
      Object.assign(res, this.computeIndexFields(src, i));
    });
    return res;
  }

  stringifyField(src: Partial<Src>, f: CompositeIndex<Src>['fields'][number]) {
    if (isNonStringField(f)) {
      return f.toString(src);
    } else {
      return src[f as string];
    }
  }

  _isCompositeIndex(index: MapperArgs<Src>['indexes'][number]): index is CompositeIndex<Src> {
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
    return sortKeyFields.map(f => this.stringifyField(src, f)).join('#')
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
  computeIndexFields(src: Partial<Src>, index: MapperArgs<Src>['indexes'][number]) {
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
