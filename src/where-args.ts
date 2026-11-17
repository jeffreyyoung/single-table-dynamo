import type { IndexFieldsDef, SecondaryIndexFieldsDefs } from "./mapper";

/** All non-empty leading slices of F: [a] | [a, b] | [a, b, c] ... */
type Prefixes<
  F extends readonly string[],
  Acc extends string[] = []
> = F extends readonly [infer H extends string, ...infer R extends string[]]
  ? [...Acc, H] | Prefixes<R, [...Acc, H]>
  : never;

type TakeN<
  F extends readonly string[],
  N extends number,
  Acc extends string[] = []
> = Acc["length"] extends N
  ? Acc
  : F extends readonly [infer H extends string, ...infer R extends string[]]
  ? TakeN<R, N, [...Acc, H]>
  : Acc;

type DropN<
  F extends readonly string[],
  N extends number,
  Count extends unknown[] = []
> = Count["length"] extends N
  ? F
  : F extends readonly [string, ...infer R extends string[]]
  ? DropN<R, N, [...Count, unknown]>
  : F;

/** One object type per allowed prefix; later index fields are forbidden. */
type WhereForPrefix<
  T,
  F extends readonly string[],
  P extends string[]
> = P extends unknown
  ? { [K in P[number] & keyof T]: T[K] } & {
      [K in Exclude<F[number], P[number]>]?: never;
    }
  : never;

/**
 * The valid arguments to `where()` for an index whose fields are F and whose
 * first PkCount fields form the partition key.
 *
 * DynamoDB key conditions require every partition key field, then sort key
 * fields in order with no gaps. At runtime a field after a gap is silently
 * ignored, so the types reject gaps.
 *
 * Falls back to `Partial<T>` when the field list is not known literally
 * (e.g. index definitions built outside the Repository constructor call).
 */
export type WhereArgs<
  T,
  F extends readonly string[],
  PkCount extends number = 1
> = number extends F["length"] // not a tuple: field order unknown
  ? Partial<T>
  : WhereForPrefix<
      T,
      F,
      | TakeN<F, PkCount>
      | (DropN<F, PkCount> extends []
          ? never
          : [...TakeN<F, PkCount>, ...Prefixes<DropN<F, PkCount>>])
    >;

type PkCountOf<D> = D extends { partitionKeyFieldCount: infer N extends number }
  ? number extends N
    ? 1
    : N
  : 1;

type IndexDefFor<
  Tag,
  IndexTag extends string,
  PrimaryIndexDef extends IndexFieldsDef,
  SecondaryIndexDefs extends SecondaryIndexFieldsDefs
> = Tag extends keyof SecondaryIndexDefs
  ? SecondaryIndexDefs[Tag]
  : string extends IndexTag
  ? IndexFieldsDef
  : Tag extends IndexTag
  ? PrimaryIndexDef
  : IndexFieldsDef;

/** `where()` argument type for `repository.query(Tag)`. */
export type WhereArgsForTag<
  T,
  Tag,
  IndexTag extends string,
  PrimaryIndexDef extends IndexFieldsDef,
  SecondaryIndexDefs extends SecondaryIndexFieldsDefs,
  Def = IndexDefFor<Tag, IndexTag, PrimaryIndexDef, SecondaryIndexDefs>
> = Def extends IndexFieldsDef
  ? WhereArgs<T, Def["fields"], PkCountOf<Def>>
  : Partial<T>;
