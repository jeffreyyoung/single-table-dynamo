
export function getDataFromDocument<T>(doc: SingleTableDocumentWithData<T>): T | null{
  if (!doc) {
    return null;
  }
  let res = {};
  Object.keys(doc).forEach(key => {
    if (!key.startsWith('__')) {
      res[key] = doc[key];
    }
  });

  return res as T;
}

export type SingleTableDocumentWithData<T> = SingleTableDocument & T;

export type SingleTableDocument = {
  __hashKey: string;
  __sortKey?: string;

  __objectType: string;

  //sparse local secondary indexes that may or not be defined
  __lsi0?: string;
  __lsi1?: string;
  __lsi2?: string;
  __lsi3?: string;
  __lsi4?: string;

  //sparse global indexes that may or not be defined
  __gsiHash0?: string;
  __gsiSort0?: string;

  __gsiHash1?: string;
  __gsiSort1?: string;

  __gsiHash2?: string;
  __gsiSort2?: string;

  __gsiHash3?: string;
  __gsiSort3?: string;

  __gsiHash4?: string;
  __gsiSort4?: string;

  __gsiHash5?: string;
  __gsiSort5?: string;

  __gsiHash6?: string;
  __gsiSort6?: string;

  __gsiHash7?: string;
  __gsiSort7?: string;

  __gsiHash8?: string;
  __gsiSort8?: string;

  __gsiHash9?: string;
  __gsiSort9?: string;

  __gsiHash10?: string;
  __gsiSort10?: string;

  __gsiHash11?: string;
  __gsiSort11?: string;
};
