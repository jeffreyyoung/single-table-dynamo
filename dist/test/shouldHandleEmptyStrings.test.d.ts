declare type ThingId = {
    id: string;
};
declare type Thing = {
    food: string;
    yay?: string;
} & ThingId;
export declare const thingRepo: import("../src/getRepository").Repository<ThingId, Thing, string>;
export {};
