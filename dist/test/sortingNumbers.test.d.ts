declare type PostId = {
    id: string;
    authorId: string;
};
declare type Post = {
    category: string;
    upvoteCount: number;
    shareCount: number;
} & PostId;
declare type QueryNames = 'byCategorySortedByUpvoteCount' | 'sortedByShareCountThenShareCount';
export declare const postRepo: import("../src/getRepository").Repository<PostId, Post, QueryNames>;
export {};
