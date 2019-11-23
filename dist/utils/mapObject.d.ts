export declare function mapObject<K extends string, T, U>(obj: Record<K, T>, f: (x: T, k: K) => U): Record<K, U>;
