declare type PurchasedLinkId = {
    id: string;
    boardId: string;
    boardOwnerId: string;
};
declare type PurchasedLink = {
    priceInUsd: number;
    hidden: boolean;
    createdAt: boolean;
    email: string;
} & PurchasedLinkId;
declare type QueryNames = 'linksByEmail' | 'boardIdSortedByPrice' | 'boardIdSortedByDate' | 'sortedByPrice' | 'sortedByDate';
export declare const purchasedLinkRepo: import("../src/getRepository").Repository<PurchasedLinkId, PurchasedLink, QueryNames>;
export {};
