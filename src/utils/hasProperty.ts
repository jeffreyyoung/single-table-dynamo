export function hasProperty<T extends object>(obj: T, property: keyof T) {
  return Object.prototype.hasOwnProperty.call(obj, property);
}
