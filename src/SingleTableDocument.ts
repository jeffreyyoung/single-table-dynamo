export type SingleTableDocument<T> = {
  hashKey: string;
  sortKey?: string;

  data: T;
  objectType: string;

  //sparse local secondary indexes that may or not be defined
  lsi0?: string;
  lsi1?: string;
  lsi2?: string;
  lsi3?: string;
  lsi4?: string;

  //sparse global indexes that may or not be defined
  gsiHash0?: string;
  gsiSort0?: string;

  gsiHash1?: string;
  gsiSort1?: string;

  gsiHash2?: string;
  gsiSort2?: string;

  gsiHash3?: string;
  gsiSort3?: string;

  gsiHash4?: string;
  gsiSort4?: string;

  gsiHash5?: string;
  gsiSort5?: string;

  gsiHash6?: string;
  gsiSort6?: string;

  gsiHash7?: string;
  gsiSort7?: string;

  gsiHash8?: string;
  gsiSort8?: string;

  gsiHash9?: string;
  gsiSort9?: string;

  gsiHash10?: string;
  gsiSort10?: string;

  gsiHash11?: string;
  gsiSort11?: string;
};
