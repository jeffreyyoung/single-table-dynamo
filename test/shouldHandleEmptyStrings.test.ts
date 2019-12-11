
  import {
    getRepository,
    ensureTableAndIndexesExist
  } from './../src/index';
import { tableName } from './config';
  



type ThingId = {
    id: string
}

type Thing = {
    food: string
    yay?: string
} & ThingId;




export const thingRepo = getRepository<ThingId, Thing>({
    objectName: 'Post'+Math.random(),
    hashKeyFields: ['id'],
    tableName: tableName,
});

beforeAll(async () => {
    await ensureTableAndIndexesExist([thingRepo]);
}, 30000);

test('should handle empty strings', async () => {
    let thing = {
        id: 'a',
        food: 'rawr',
        yay: ''
    }

    await thingRepo.put(thing);

    let gote = await thingRepo.get({id: thing.id});
    
    expect(gote!.yay).toEqual(null);
});