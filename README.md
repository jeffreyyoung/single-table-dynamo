# Single Table Dynamodb

Right now this library is an experiment 👨‍🔬

There are a few other dynamodb clients that help simplify using dynamodb in a node environment, but they all encourage the use of multiple tables.  This client is built with the idea that all application data stored in dynamodb should be stored in a single table. https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-general-nosql-design.html

## Getting Started


### First create a table
```javascript
import { createTable } from 'single-table-dynamo';

//create a table, you should only run this function once to setup the table
await createTable();

```


### Next create a repository
For each type of object (e.g. user, event, post) there should be a different repo (e.g. userRepo, eventRepo, postRepo)

```javascript

import { getRepository} from 'single-table-dynamo';

//create a repository that stores a specific type of object into the table
const userRepo = getRepository({
    hashKeyFields: ['id'], //specify which properties of the object make up the id
    objectName: 'User' //specify a unique name for this object
});

let user1 = await userRepo.create({id: 1, name: 'halpert'});
let user2 = await userRepo.create({id: 2, name: 'beasley'});
let halpert = await userRepo.get({id: 1});

console.log(halper)// {id:1, name: 'halper'}

await userRepo.delete({id: 1}); //bye jim
console.log(await userRepo.get({id: 1})) //null
```

### Advanced usage with typescript

```typescript

import { getRepository} from 'single-table-dynamo';

//create a type the represent the ID for this object
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

type QueryKeys = 'getPurchasersOfItem' | 'latestPurchases' | 'location' | 'latestPurchasesByCountry'

const repo = getRepository<PurchaseID, Purchase, 'getPurchasersOfItem' | 'latestPurchases' | 'location' | 'latestPurchasesByCountry'>({
    objectName: 'Purchase',
    hashKeyFields: ['userId'],
    sortKeyFields: ['itemId', 'id'],
    queries: {
        getMyPurchases: {
            isPrimary: true
        },
        //these queries will use Global Secondary indexes
        getPurchasersOfItem: {
            which: 0,
            hashKeyFields: ['itemId'],
            sortKeyFields: ['purchaseDate', 'userId']
        },
        latestPurchasersOfItemByCountry: {
            which: 1,
            hashKeyFields: ['itemId'],
            sortKeyFields: ['country', 'state', 'city']
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
        },
        purchasesByLocation: {
            which: 1,
            sortKeyFields: ['country', 'state', 'city', 'purchaseDate', 'itemId']
        },
        latestPurchasesByCountry: {
            which: 1,
            sortKeyFields: ['country', 'purchaseDate']
        }
    }
});


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

//get the latest purchases purchased in the usa
let {results} = await repo.queries.latestPurchasesInCountry({
    args: {country: 'usa'}
});
console.log(results); // [ {id: '1', ...}, {id: '2', ...}]

//get all of angela's latest purchases
let {results} = await repo.queries.latestPurchases({
    args: {userId: 'angela'}
});
console.log(results); // [{id: '2',itemId: 'cat-food',userId: 'angela'...}]

//you can also call repo.query() which will guess which index to use for a query
let {results} = await repo.query({
    args: {userId: 'creed'}
});
//returns creed's purchases
console.log(results) // [{id: '1', userId: 'creed', ...}];

//if you call repo.query(), and not enough information is passed in to find
//an suitable index, an error will be thrown
let {results} = await repo.query({
    args: {city: 'scranton'}
})
//throws 'there is not a suitable index for this query'

````