import { expectTypeOf } from "expect-type";
import { z } from "zod";
import { createFactory, Repository } from "..";
import type { InferIdType } from "..";

// Compile-time checks for `repository.query(tag).where(...)`.
// Type-only: each block is compiled by ts-jest but never executed, since the
// invalid calls would (correctly) throw at runtime.
const typeCheck = (_name: string, _fn: () => void) => undefined;

const schema = z.object({
  id: z.string(),
  owner: z.string(),
  name: z.string(),
  title: z.string(),
  country: z.string(),
  state: z.string(),
  city: z.string(),
});

const repo = new Repository({
  typeName: "Thing",
  tableName: "table",
  schema,
  documentClient: {} as any,
  primaryIndex: {
    tag: "primary",
    pk: "pk0",
    sk: "sk0",
    fields: ["owner", "id"],
  },
  secondaryIndexes: {
    byOwnerNameTitle: {
      pk: "pk1",
      sk: "sk1",
      indexName: "gsi1",
      fields: ["owner", "name", "title"],
    },
    byLocation: {
      pk: "pk2",
      sk: "sk2",
      indexName: "gsi2",
      partitionKeyFieldCount: 2,
      fields: ["country", "state", "city"],
    },
  },
});

typeCheck("primary index: leading prefixes only", () => {
  repo.query("primary").where({ owner: "a" });
  repo.query("primary").where({ owner: "a", id: "1" });
  // @ts-expect-error -- missing partition key field `owner`
  repo.query("primary").where({ id: "1" });
  // @ts-expect-error -- `name` is not part of the primary index
  repo.query("primary").where({ owner: "a", name: "x" });
});

typeCheck("secondary index: sort key fields in order, no gaps", () => {
  repo.query("byOwnerNameTitle").where({ owner: "a" });
  repo.query("byOwnerNameTitle").where({ owner: "a", name: "b" });
  repo.query("byOwnerNameTitle").where({ owner: "a", name: "b", title: "c" });
  // @ts-expect-error -- gap: `title` without `name` would be silently ignored
  repo.query("byOwnerNameTitle").where({ owner: "a", title: "c" });
  // @ts-expect-error -- empty where
  repo.query("byOwnerNameTitle").where({});
  // @ts-expect-error -- wrong value type
  repo.query("byOwnerNameTitle").where({ owner: 1 });
});

typeCheck("partitionKeyFieldCount: all partition key fields required", () => {
  repo.query("byLocation").where({ country: "US", state: "UT" });
  repo.query("byLocation").where({ country: "US", state: "UT", city: "SLC" });
  // @ts-expect-error -- `state` is part of the partition key
  repo.query("byLocation").where({ country: "US" });
});

typeCheck("unknown tags are rejected", () => {
  // @ts-expect-error -- not an index tag
  repo.query("nope");
});

typeCheck("existing inference is unchanged", () => {
  expectTypeOf<InferIdType<typeof repo>>().toEqualTypeOf<{
    owner: string;
    id: string;
  }>();
});

typeCheck("chaining keeps the where type", () => {
  repo.query("byOwnerNameTitle").limit(5).sort("desc").where({ owner: "a" });
  // @ts-expect-error -- still checked after other builder calls
  repo.query("byOwnerNameTitle").limit(5).where({ name: "b" });
});

typeCheck("createFactory repositories are checked too", () => {
  const create = createFactory({
    typeName: "Thing",
    tableName: "table",
    schema,
    documentClient: {} as any,
    primaryIndex: { tag: "primary", pk: "pk0", sk: "sk0", fields: ["id"] },
    secondaryIndexes: {
      byOwnerName: {
        pk: "pk1",
        sk: "sk1",
        indexName: "gsi1",
        fields: ["owner", "name"],
      },
    },
  });
  create().query("byOwnerName").where({ owner: "a", name: "b" });
  // @ts-expect-error -- missing partition key field `owner`
  create().query("byOwnerName").where({ name: "b" });
});

typeCheck("index definitions not known literally fall back to Partial", () => {
  const fields: ("owner" | "name")[] = ["owner", "name"];
  const loose = new Repository({
    typeName: "Thing",
    tableName: "table",
    schema,
    documentClient: {} as any,
    primaryIndex: { tag: "primary", pk: "pk0", sk: "sk0", fields: ["id"] },
    secondaryIndexes: {
      byOwnerName: { pk: "pk1", sk: "sk1", indexName: "gsi1", fields },
    },
  });
  loose.query("byOwnerName").where({ name: "b" });
});

test("where() type checks compile", () => {
  expect(repo.query("primary")).toBeDefined();
});
