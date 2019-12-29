import {
    getRepository,
    ensureTableAndIndexesExist,
} from './../src/index';
import { tableName } from './config';



type LikeId = {
    likerId: string,
    likedId: string
}

type Like = LikeId & {
    date: number
    sparseLikedId?: string
    sparseDateStr?: string
}

let likeRepo = getRepository<LikeId, Like, 'myMostRecentLikes' | 'peopleThatLikedMe'>({
    objectName: 'Like',
    hashKeyFields: ['likerId'],
    sortKeyFields: ['likedId'],
    tableName: tableName,
    indexes: {
        myMostRecentLikes: {
            type: 'globalSecondaryIndex',
            hashKeyFields: ['likerId'],
            sortKeyFields: ['date'],
            which: 1
        },
        peopleThatLikedMe: {
            type: 'globalSecondaryIndex',
            indexName: 'peopleThatLikedMe',
            hashKeyAttributeName: 'sparseLikedId',
            sortKeyAttributeName: 'sparseDateStr'
        }
    },
});


beforeAll(async () => {
    ensureTableAndIndexesExist([
        likeRepo
    ])
})



test('custom index should work', async () => {
    let time = (new Date()).getTime();
    let likedId = time + '1';
    let created = await likeRepo.put({
        likedId,
        likerId: '2',
        sparseLikedId: likedId,
        sparseDateStr: time + '',
        date: time
    });

    expect(created).toBeTruthy();
    let res = await likeRepo.indexes.peopleThatLikedMe().where({
        sparseLikedId: likedId
    }).get();

    expect(res.results.length).toBe(1);

    await likeRepo.getDocClient().update({
        TableName: likeRepo.config.tableName,
        Key: likeRepo.getKey({ likedId, likerId: created.likerId }),
        UpdateExpression: 'REMOVE sparseLikedId, sparseDateStr',
    }).promise();
    // let update = await likeRepo.put({
    //     likedId,
    //     likerId: '2',
    //     date: time
    // });
    // expect(update).toBeTruthy();

    expect((await likeRepo.indexes.peopleThatLikedMe().where({
        sparseLikedId: likedId
    }).get()).results.length).toBe(0);
});