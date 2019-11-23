import { getRepository } from './getRepository';
import { ensureTableAndIndexesExist } from './ensureTableAndIndexesAreCreated';
import { setDefaultTableName } from './createTable';
import { WORKAROUND_updateAWSConfig, AWS } from './AWS';
export { WORKAROUND_updateAWSConfig, ensureTableAndIndexesExist, getRepository, setDefaultTableName, AWS };
