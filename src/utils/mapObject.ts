export function mapObject<K extends string, T, U>(
  obj: Record<K, T>,
  f: (x: T, k: K) => U
): Record<K, U> {
  let res = {} as any;
  Object.keys(obj).forEach(k => {
    res[k] = f(obj[k], k as K);
  });
  return res;
}
