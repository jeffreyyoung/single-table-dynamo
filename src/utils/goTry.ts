export function goTry<T>(fn: () => T): [T | undefined, undefined | any] {
  let res: T | undefined = undefined;
  let error: any = undefined;
  try {
    res = fn();
  } catch (e) {
    error = e;
  }
  return [res, error];
}
