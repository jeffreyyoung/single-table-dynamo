
  import {
    WORKAROUND_updateAWSConfig,
    getRepository,
    ensureTableAndIndexesExist
  } from './../src/index';
  
  require('dotenv').config();
  
  WORKAROUND_updateAWSConfig({
    region: 'us-west-2',
    accessKeyId: process.env.AWS_KEY,
    secretAccessKey: process.env.AWS_SECRET,
  
    // accessKeyId: 'wat',//process.env.AWS_KEY,
    // secretAccessKey: 'yay',//process.env.AWS_SECRET,
    //endpoint: "http://localhost:8000"
  } as any);



type PostId = {
    id: string
    authorId: string
}

type Post = {
    category: string
    upvoteCount: number
    shareCount: number
} & PostId;



type QueryNames = 'byCategorySortedByUpvoteCount' | 'sortedByShareCountThenShareCount'

export const postRepo = getRepository<PostId, Post, QueryNames>({
    objectName: 'Post'+Math.random(),
    hashKeyFields: ['authorId'],
    sortKeyFields: ['id'],
    queries: {
        'byCategorySortedByUpvoteCount': {
            type: 'globalSeconaryIndex',
            hashKeyFields: ['category'],
            sortKeyFields: ['upvoteCount'],
            which: 0
        },
        'sortedByShareCountThenShareCount': {
            type: 'globalSeconaryIndex',
            hashKeyFields: ['category'],
            sortKeyFields: ['shareCount', 'upvoteCount'],
            which: 1
        },
    }
});

beforeAll(async () => {
    await ensureTableAndIndexesExist([postRepo]);
}, 30000);

test('should properly sort', async () => {
    
   let post1: Post = {
       upvoteCount: 10,
       shareCount: 1,
       id: '1',
       authorId: 'me',
       category: 'food',
   }

   let post2: Post = {
       upvoteCount: 9,
       shareCount: 9,
       id: '2',
       authorId: 'me',
       category: 'food'
   }

   await postRepo.put(post1)
   await postRepo.put(post2)

   let response = await postRepo.queries.byCategorySortedByUpvoteCount({
       args: {
           category: 'food'
       },
   });

   expect(response.results).toEqual([post1, post2]);

   let response2 = await postRepo.queries.sortedByShareCountThenShareCount({
       args: {
           category: 'food'
       }
   });
   expect(response2.results).toEqual([post2,post1]);
}, 15000);