import { getSortkeyForBeginsWithQuery, getRepository } from "../src/getRepository"

type PurchaseID = {
    id: string
    userId: string
    itemId: string
}

type Purchase = PurchaseID & {
    purchaseDate: number
    country: string
    state: string
    city: string
}


function getDefaultObject(): Purchase {
    return {
        id: '1234',
        purchaseDate: 1572481596741,
        city: 'provo',
        state: 'ut',
        country: 'usa',
        itemId: 'awesomecouch',
        userId: '1208493'
    }
}

type UserId = {id: string}
type User = {name: string} & UserId;

const userRepo = getRepository<UserId, User>({
    tableName: 'Global_Table',
    hashKeyFields: ['id'],
    compositeKeySeparator: '#',
    objectName: 'User',
});

const repo = getRepository<PurchaseID, Purchase, 'getPurchasersOfItem' | 'latestPurchases' | 'location' | 'latestPurchasesByCountry'>({
    tableName: 'Global_Table',
    hashKeyFields: ['userId'],
    sortKeyFields: ['itemId', 'id'],
    compositeKeySeparator: '#',
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

test('should format object for dynamodb properly', () => {
    let formatted = repo.formatForDDB(getDefaultObject());

    expect(formatted).toEqual({
        hashKey: 'Purchase#userId-1208493',
        sortKey: 'Purchase#itemId-awesomecouch#id-1234',
        data:
        {
            id: '1234',
            purchaseDate: 1572481596741,
            city: 'provo',
            state: 'ut',
            country: 'usa',
            itemId: 'awesomecouch',
            userId: '1208493'
        },
        objectType: 'Purchase',
        gsiHash0: "Purchase-getPurchasersOfItem#itemId-awesomecouch",
        gsiSort0: "getPurchasersOfItem#purchaseDate-1572481596741#userId-1208493",
        lsi1: 'latestPurchases#purchaseDate-1572481596741#itemId-awesomecouch',
        lsi2: 'location#country-usa#state-ut#city-provo#purchaseDate-1572481596741#itemId-awesomecouch',
        lsi3: 'latestPurchasesByCountry#country-usa#purchaseDate-1572481596741'
    })
});

test('should find correct index for where query', () => {
    let index = repo.findIndexForQuery({
        args: {
            userId: '23484930',
            country: 'usa',
            state: 'ut',
            city: 'provo'
        }
    });
    expect(index).not.toBeNull();
    expect(index && index.tag).toBe('location');
});

test('should properly format sort key for begins with query', () => {
    const where ={
        args: {
            userId: '23484930',
            country: 'usa',
            state: 'ut',
            city: 'provo'
        }
    };
    let index = repo.findIndexForQuery(where);

    let key = getSortkeyForBeginsWithQuery<PurchaseID, Purchase>(where.args, index && index.sortKeyFields || [], index && index.sortKeyDescriptor || '', repo.config.compositeKeySeparator);
    expect(key).toBe('location#country-usa#state-ut#city-provo');
})

test('should handle invalid params', () => {
    expect(repo.findIndexForQuery({
            args: {
                country: 'usa'
            }
        })
    ).toBeNull();
});

test('should not find an index for invalid query', () => {

    let index = repo.findIndexForQuery({
        args: {
            country: 'usa',
            city: 'provo',
            userId: '94859430',
            purchaseDate: 495803,
            id: '03485903485',
            itemId: '584903049'
        }
    });

    expect(index).toBeNull();
});

test('should handle null sortIndex', () => {
    let res = userRepo.formatForDDB({
        id: '1',
        name: 'jim'
    });
    expect(res).toEqual({ data: { id: '1', name: 'jim' }, objectType: 'User', hashKey: 'User#id-1' });
})