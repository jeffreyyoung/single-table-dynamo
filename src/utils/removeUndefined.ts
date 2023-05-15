export const removeUndefined = <T extends object>(obj: T): Partial<T> => {
  if (Array.isArray(obj)) {
    return obj;
  }
  const newObj: Partial<T> = {};
  (Object.keys(obj) as Array<keyof T>).forEach((key) => {
    if (obj[key] !== undefined) {
      newObj[key] = obj[key];
    }
  });

  return newObj;
};
