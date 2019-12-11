import { tableName } from './config';
import {
    getRepository,
  } from '../src/getRepository';



type PurchasedLinkId = {
    id: string
    boardId: string
    boardOwnerId: string
}

type PurchasedLink = {
    priceInUsd: number
    hidden: boolean
    createdAt: boolean
    email: string
} & PurchasedLinkId;



type QueryNames = 'linksByEmail' | 'boardIdSortedByPrice' | 'boardIdSortedByDate' | 'sortedByPrice' | 'sortedByDate'

export const purchasedLinkRepo = getRepository<PurchasedLinkId, PurchasedLink, QueryNames>({
    objectName: 'PurchasedLink',
    hashKeyFields: ['boardOwnerId'],
    tableName: tableName,
    sortKeyFields: ['boardId', 'id'],
    queries: {
        'boardIdSortedByPrice': {
            type: 'globalSecondaryIndex',
            hashKeyFields: ['boardOwnerId', 'boardId'],
            sortKeyFields: ['hidden', 'priceInUsd', 'createdAt'],
            which: 0
        },
        'boardIdSortedByDate': {
            type: 'globalSecondaryIndex',
            hashKeyFields: ['boardOwnerId', 'boardId'],
            sortKeyFields: ['hidden', 'createdAt', 'priceInUsd'],
            which: 1
        },
        'sortedByPrice': {
            type: 'localSecondaryIndex',
            sortKeyFields: ['hidden', 'priceInUsd', 'createdAt', 'id'],
            which: 0
        },
        'sortedByDate': {
            type: 'localSecondaryIndex',
            sortKeyFields: ['hidden', 'createdAt', 'priceInUsd', 'id'],
            which: 1
        },
        'linksByEmail': {
            type: 'globalSecondaryIndex',
            hashKeyFields: ['email'],
            sortKeyFields: ['createdAt'],
            which: 2
        }
    }
});


test('should be able to find correct index', async () => {
    expect(
        purchasedLinkRepo.findIndexForQuery({
            args: {
                email: 'yeehaw',
            }
        })!.tag
    ).toBe('linksByEmail');

    expect(
        purchasedLinkRepo.findIndexForQuery({
            args: {
                boardOwnerId: 'yeehaw',
                hidden: false
            }
        })!.tag
    ).toBe('sortedByPrice');
    
    expect(
        purchasedLinkRepo.findIndexForQuery({
            args: {
                boardOwnerId: 'yeehaw',
                hidden: false
            },
            sortBy: 'createdAt'
        })!.tag
    ).toBe('sortedByDate');

    expect(
        purchasedLinkRepo.findIndexForQuery({
            args: {
                boardOwnerId: 'yeehaw',
                boardId: 'yay',
                hidden: false
            },
            sortBy: 'createdAt'
        })!.tag
    ).toBe('boardIdSortedByDate');

    expect(
        purchasedLinkRepo.findIndexForQuery({
            args: {
                boardOwnerId: 'yeehaw',
                boardId: 'yay',
                hidden: false
            },
            sortBy: 'priceInUsd'
        })!.tag
    ).toBe('boardIdSortedByPrice');
})