# Single Table Dynamodb

Right now this library is an experiment 👨‍🔬

There are a few other dynamodb clients that help simplify using dynamodb in a node environment, but they all encourage the use of multiple tables.  This client is built with the idea that all application data stored in dynamodb should be stored in a single table. https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-general-nosql-design.html

## Getting Started



#### First create a repository
For each type of object (e.g. user, event, post) there should be a different repo (e.g. userRepo, eventRepo, postRepo)

```javascript

import { getRepository} from 'single-table-dynamo';

//create a repository that stores a specific type of object into the table
const userRepo = getRepository({
    hashKeyFields: ['id'], //specify which properties of the object make up the id
    objectName: 'User' //specify a unique name for this object
});
```

#### Before running our application lets ensure our table exists
```javascript
import {ensureTableAndIndexesExist} from 'single-table-dynamo';

ensureTableAndIndexesExist([userRepo]);
```

Now use the newly create repository to save object to our database

```javascript
let user1 = await userRepo.create({id: 1, name: 'halpert'});
let user2 = await userRepo.create({id: 2, name: 'beasley'});

let halpert = await userRepo.get({id: 1});

console.log(halpert)// {id:1, name: 'halpert'}

await userRepo.delete({id: 1}); //bye jim
console.log(await userRepo.get({id: 1})) //null
```

### Advanced usage with typescript

Let's create a repo for tracking purchases.

With typescript, we will create an ID type and an ITEM type.  The ID type contains the fields required to get an entity.  The Item type contains all the fields present on the entity
```typescript

import { getRepository} from 'single-table-dynamo';

//these fields are required to get/update an item
type PurchaseId = {
    id: string
    itemId: string
    userId: string
}

//additional meta data
type Purchase = PurchaseId & {
    purchaseTime: number
    country: string
    state: string
    city: string
}

```

Next we create our repo, we will define some queries that will be useful to our application.

Our application requires that we be able to
* get all purchases of a user ordered by recency
* get the latest purchases in a country
* get the latest purchasers of an item

We should ensure that an index exists for each necessary query.  We can specify the indexes for this object below
```typescript
type QueryKeys = 'latestPurchases' | 'latestPurchasesInCountry' | 'latestPurchasersOfItem'

const repo = getRepository<PurchaseID, Purchase, QueryKeys>({
    objectName: 'Purchase',
    hashKeyFields: ['userId'],
    sortKeyFields: ['itemId', 'id'],
    indexes: {
        getMyPurchases: {
            isPrimary: true
        },
        //these queries will use Global Secondary indexes
        latestPurchasersOfItem: {
            which: 0,
            hashKeyFields: ['itemId'],
            sortKeyFields: ['purchaseDate']
        },
        latestPurchasesInCountry: {
            which: 2,
            hashKeyFields: ['country'],
            sortKeyFields: ['purchaseDate']
        },


        //these queries will use Local Secondary Indexes
        latestPurchases: {
            sortKeyFields: ['purchaseDate', 'itemId'],
            which: 0
        }
    }
});
```

We store some purchases in our database

```typescript

let purchase1 = await repo.create({
    id: '1',
    itemId: 'scuba-tank',
    userId: 'creed',
    purchaseTime: (new Date()).getTime(),
    country: 'usa',
    state: 'pa',
    city: 'scranton'
});

let purchase2 = await repo.create({
    id: '2',
    itemId: 'cat-food',
    userId: 'angela',
    purchaseTime: (new Date()).getTime(), //now
    country: 'usa',
    state: 'ks',
    city: 'otis'
})
```

And now we can query items in our database

```typescript
//get all of angela's latest purchases
let {results} = await repo.query()
    .index('latestPurchases')
    .where({userId: 'angela'})
    .get()
console.log(results); // [{id: '2',itemId: 'cat-food',userId: 'angela'...}]


//get the latest purchases purchased in the usa
let {results, nextPageArgs} = await repo.query()
    .index('latestPurchasesInCountry')
    .where({country: 'usa'})
    .limit(1)
    .get();

console.log(results); // [ {id: '1', ...}]
//get the next page
let {results} = await repo.query().withArgs(naxPageArgs).get();
console.log(results); // [ {id: '2', ...}]


//get the most recent purchasers of 'cat-food'
let {results, nextPageArgs} = await repo.query()
    .index('latestPurchasersOfItem')
    .where({itemId: 'cat-food'})
    .limit(1)
    .get();

//you can also call repo.query() which will guess which index to use for a query
let {results} = await repo.query()
    .where({userId: 'creed'})
    .get();
//returns creed's purchases
console.log(results) // [{id: '1', userId: 'creed', ...}];

//if you call repo.query(), and not enough information is passed in to find
//an suitable index, an error will be thrown
let {results} = await repo
    .query()
    .where({city: 'scranton'})
    .get()

//throws 'there is not a suitable index for this query'
```


## How it works

Everything stored in our dynamodb table has the same below shape.

The dynamo table is configured to have local secondary indexes on the fields `lsi0`, `lsi1`,...`lsi4`.  And global secondary indexes on the fields `gsiHash0`, `gsiSort0`,...`gsiHash19`, `gsiSort19`

```typescript

export type SingleTableDocument<T> = {
    __hashKey: string
    __sortKey?: string

    
    __objectType: string

    //sparse local secondary indexes that may or not be defined
    __lsi0?: string
    ...
    __lsi4?: string

    //sparse global indexes that may or not be defined
    __gsiHash0?: string
    __gsiSort0?: string
    ...
    __gsiHash19?: string
    __gsiSort19?: string
} & T
```

When we create and save an object, depending on the indexes defined for the object, we set some of the indexed properties

So for the following repo:

```typescript
const purchaseRepo = getRepository<PurchaseID, Purchase, 'getPurchasersOfItem' | 'latestPurchases' | 'location' | 'latestPurchasesByCountry'>({
    hashKeyFields: ['userId'],
    sortKeyFields: ['itemId', 'id'],
    objectName: 'Purchase',
    queries: {
        getPurchasersOfItem: {
            which: 0,
            hashKeyFields: ['itemId'],
            sortKeyFields: ['purchaseDate', 'userId']
        },
        latestPurchases: {
            sortKeyFields: ['purchaseDate', 'itemId'],
            which: 1
        },
        location: {
            which: 2,
            sortKeyFields: ['country', 'state', 'city', 'purchaseDate', 'itemId']
        },
        latestPurchasesByCountry: {
            which: 3,
            sortKeyFields: ['country', 'purchaseDate']
        }
    }
});
```

When we create an item like this

```typescript
purchaseRepo.create({
    id: '1234',
    purchaseDate: 1572481596741,
    city: 'provo',
    state: 'ut',
    country: 'usa',
    itemId: 'awesomecouch',
    userId: '1208493'
});
```


This is what is stored in dynamodb

```javascript
let json ={
    __hashKey: 'Purchase#userId-1208493',
    __sortKey: 'Purchase#itemId-awesomecouch#id-1234',
    id: '1234',
    purchaseDate: 1572481596741,
    city: 'provo',
    state: 'ut',
    country: 'usa',
    itemId: 'awesomecouch',
    userId: '1208493'
    __objectType: 'Purchase',
    __gsiHash0: "Purchase-getPurchasersOfItem#itemId-awesomecouch",
    __gsiSort0: "getPurchasersOfItem#purchaseDate-1572481596741#userId-1208493",
    __lsi1: 'latestPurchases#purchaseDate-1572481596741#itemId-awesomecouch',
    __lsi2: 'location#country-usa#state-ut#city-provo#purchaseDate-1572481596741#itemId-awesomecouch',
    __lsi3: 'latestPurchasesByCountry#country-usa#purchaseDate-1572481596741'
}
```

For a simpler repo with no indexes, none of the indexes would be defined

Repo:
```typescript

type UserId = {id: string}
type User = {name: string} & UserId;

const userRepo = getRepository<UserId, User>({
    hashKeyFields: ['id'],
    objectName: 'User',
});
```

After creating the following object
```typescript
userRepo.create({
        id: '1',
        name: 'jim'
})
```

The following is stored in dynamodb
```javascript
{ 
    id: '1',
    name: 'jim'
    __objectType: 'User',
    __hashKey: 'User#id-1'
}
```

