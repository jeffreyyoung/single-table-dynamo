import { expectTypeOf } from "expect-type";
import { z } from "zod";
import { Repository } from "..";
const j = z.object({
  id: z.string(),
});

type meow = z.TypeOf<typeof j>;

const repository = new Repository(
  {
    schema: z.object({
      id: z.string(),
      name: z.string(),
      age: z.number().min(18).max(120),
    }),
    tableName: "meow",
    primaryIndex: {
      fields: ["id"],
      pk: "pk0",
      sk: "sk0",
    },
    typeName: "person",
  },
  {} as any
);

test("main repo methods should be correctly typed", () => {
  expectTypeOf(repository.get).parameter(0).toMatchTypeOf<{ id: string }>();

  expectTypeOf(repository.get).returns.toMatchTypeOf<
    Promise<{
      id: string;
      name: string;
      age: number;
    } | null>
  >();
});
