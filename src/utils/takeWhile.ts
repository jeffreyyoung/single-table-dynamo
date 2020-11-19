export const takeWhile = <T>(arr: T[], func: (arg: T) => boolean) => {
  for (const [i, val] of arr.entries()) if (func(val)) return arr.slice(0, i);
  return arr;
};