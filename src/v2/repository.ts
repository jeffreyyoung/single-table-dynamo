import { IndexQueryBuilder } from './index-query-builder'
import { MapperArgs, Mapper } from './mapper'

type RepoArgs<Src> = {
  tableName: string
} & MapperArgs<Src>


export  class Repository<ID, Src> {
  args: RepoArgs<Src>
  mapper: Mapper<Src>

  constructor(args: RepoArgs<Src>) {
    this.args = args;
    this.mapper = new Mapper<Src>(args);
  }
  get(id: ID){

  }
  put(src: Src){}
  update(src: Partial<Src> & ID){}
  delete(id: Src){}
  query(tag: string) {
    const builder = new IndexQueryBuilder(
      this.args.tableName,
      this.indexByTag(tag),
      this.mapper
    );
    return builder
  }
  indexByTag(tag: string) {
    const index = this.args.indexes.find(i => i.tag === tag)
    if (!index) {
      throw new Error(`No index exists for that tag, tag: ${tag}, args: ${JSON.stringify(this.args, null, 3)}`)
    }
    return index;
  }
}