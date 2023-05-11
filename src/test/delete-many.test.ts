import { getUserRepo } from "./utils/getUserRepo";

test("delete many works", async () => {
  const repo = getUserRepo();

  await repo.put({
    id: "1",
    name: "jim",
    age: 1,
  });
  await repo.put({
    id: "2",
    name: "pam",
    age: 1,
  });

  expect(repo.get({ id: "1" })).resolves.toMatchInlineSnapshot(`
Object {
  "age": 1,
  "id": "1",
  "name": "jim",
}
`);
  expect(repo.get({ id: "2" })).resolves.toMatchInlineSnapshot(`
Object {
  "age": 1,
  "id": "2",
  "name": "pam",
}
`);

  await repo.deleteMany([{ id: "1" }, { id: "2" }]);

  expect(repo.get({ id: "1" })).resolves.toMatchInlineSnapshot(`null`);
  expect(repo.get({ id: "2" })).resolves.toMatchInlineSnapshot(`null`);
});
