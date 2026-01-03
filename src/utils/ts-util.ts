export const objectEntries = <T extends Record<string, unknown>>(
    object: T
): Array<[keyof T, ValueOf<T>]> => {
    return Object.entries(object) as Array<[keyof T, ValueOf<T>]>;
};

export const objectKeys = <T extends Record<string, unknown>>(
    object: T
): Array<keyof T> => {
    return Object.keys(object) as Array<keyof T>;
};

export type ValueOf<T> = T[keyof T];

export type ArrayType<T> = T extends Array<infer U> ? U : T;

export const isNotNull = <T>(value: T | undefined): value is T => value != null;

export type Tuple<T, N extends number> = N extends N
    ? number extends N
        ? T[]
        : _TupleOf<T, N, []> // eslint-disable-line @typescript-eslint/ban-types
    : never;
type _TupleOf<T, N extends number, R extends unknown[]> = R["length"] extends N
    ? R
    : _TupleOf<T, N, [T, ...R]>;

export type Newable<T> = new (...args: any[]) => T;

export type Entries<T> = Array<
    {
        [K in keyof T]: [K, T[K]];
    }[keyof T]
>;
