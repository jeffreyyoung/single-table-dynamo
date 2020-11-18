import { IndexQueryBuilder } from './index-query-builder';
import { MapperArgs, Mapper } from './mapper';
declare type RepoArgs<Src> = {
    tableName: string;
} & MapperArgs<Src>;
export declare class Repository<ID, Src> {
    args: RepoArgs<Src>;
    mapper: Mapper<Src>;
    constructor(args: RepoArgs<Src>);
    get(id: ID): void;
    put(src: Src): void;
    update(src: Partial<Src> & ID): void;
    delete(id: Src): void;
    query(tag: string): IndexQueryBuilder<Src>;
    indexByTag(tag: string): import("./mapper").SingleTableIndex<Src>;
}
export {};
