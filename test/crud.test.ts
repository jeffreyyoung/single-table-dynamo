import {
  getRepository,
  ensureTableAndIndexesExist,
} from './../src/index';
import { tableName } from './config';


type PurchaseId = {
  userId: string;
  itemId: string;
};

type Purchase = {
  createdAt: number;
} & PurchaseId;
type PurchaseQueries = 'mostRecentPurchases' | 'purchasersOfItem';

let purchase1 = {
  userId: 'jim',
  itemId: 'jello',
  createdAt: 1574140686111,
};

let purchase2 = {
  userId: 'dwight',
  itemId: 'battle star gallactica',
  createdAt: 1574140686222,
};

let purchase3 = {
  userId: 'jim',
  itemId: 'guitar',
  createdAt: 1574140686333,
};

let purchaseRepo = getRepository<PurchaseId, Purchase, PurchaseQueries>({
  objectName: 'purchase' + Math.random(),
  hashKeyFields: ['userId'],
  sortKeyFields: ['itemId'],
  tableName: tableName,
  shouldPadNumbersInIndexes: false,
  queries: {
    mostRecentPurchases: {
      sortKeyFields: ['createdAt'],
      which: 0,
    },
    purchasersOfItem: {
      hashKeyFields: ['itemId'],
      sortKeyFields: ['createdAt'],
      which: 0,
    },
  },
});

const userRepo = getRepository<
  { id: string },
  { id: string; stripeId: string; email: string }
>({
  tableName: tableName,
  objectName: 'User'+Math.random(),
  hashKeyFields: ['id'],
  shouldPadNumbersInIndexes: false
});
//const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

test('should create table', async () => {
  await ensureTableAndIndexesExist([purchaseRepo, userRepo]);
  //wait(30000);
}, 60000);

test('repo with no lsi should work', async () => {
  expect(await userRepo.get({ id: 'meow' })).not.toBeTruthy();

  let res = await userRepo.put({ id: 'meow', stripeId: 'wow', email: 'hi' });
  expect(await userRepo.get({ id: 'meow' })).toEqual(res);
});

test('should create items', async () => {
  let f1 = await purchaseRepo.overwrite(purchase1);
  expect(f1).toEqual(purchase1);
  await purchaseRepo.overwrite(purchase2);
  await purchaseRepo.overwrite(purchase3);
});

test('local secondary index query should work', async () => {
  let jimsPurchases = await purchaseRepo.queries.mostRecentPurchases({
    sort: 'asc',
    args: {
      userId: 'jim',
    },
  });
  expect(jimsPurchases.results).toEqual([purchase1, purchase3]);
  expect(jimsPurchases.nextPageArgs).not.toBeTruthy();
});

test('next page args should work', async () => {
  let r1 = await purchaseRepo.queries.mostRecentPurchases({
    sort: 'asc',
    args: {
      userId: 'jim',
    },
    limit: 1,
  });

  expect(r1.results).toEqual([purchase1]);
  expect(r1.nextPageArgs).toBeTruthy();

  let r2 = await purchaseRepo.queries.mostRecentPurchases(
    r1.nextPageArgs as any
  );
  expect(r2.results).toEqual([purchase3]);
  //expect(r2.nextPageArgs).not.toBeTruthy();
});

test('pagination sort descending should work', async () => {
  let desc1 = await purchaseRepo.queries.mostRecentPurchases({
    sort: 'desc',
    args: {
      userId: 'jim',
    },
    limit: 1
  });

  expect(desc1.results).toEqual([purchase3]);
  expect(desc1.nextPageArgs).toBeTruthy();

  expect((await purchaseRepo.queries.mostRecentPurchases(desc1.nextPageArgs!)).results)
    .toEqual([purchase1]);
});

test('global secondary index should work', async () => {
  let peopleThatPurchasedJello = await purchaseRepo.queries.purchasersOfItem({
    args: {
      itemId: 'jello',
    },
  });
  expect(peopleThatPurchasedJello.results).toEqual([purchase1]);
});

test('delete should work', async () => {
  let thing = await purchaseRepo.get({ userId: 'jim', itemId: 'yay' });
  expect(thing).not.toBeTruthy();
  let created = await purchaseRepo.overwrite({
    userId: 'jim',
    itemId: 'yay',
    createdAt: new Date().getTime(),
  });
  expect(created).toBeTruthy();
  expect(created).toEqual(
    await purchaseRepo.get({ userId: 'jim', itemId: 'yay' })
  );
});

test('update should work', async () => {
  let original = { userId: 'michael', itemId: 'mug', createdAt: 1 };
  let created = await purchaseRepo.put(original);
  let get = () => purchaseRepo.get({ userId: 'michael', itemId: 'mug' });
  expect(original).toEqual(created);
  expect(original).toEqual(await get());
  let updated = await purchaseRepo.update(
    { userId: 'michael', itemId: 'mug' },
    { createdAt: 5 }
  );
  expect(await get()).toEqual(updated);
  expect(updated.createdAt).toBe(5);
});
