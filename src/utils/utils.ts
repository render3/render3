import type { Point2 } from "../scene/shape";

export const removeArrayItem = <T>(array: T[], item?: T, index?: number): T => {
    const arrayIndex = index ?? array.indexOf(item!);
    return array.splice(arrayIndex, 1)[0];
};

export const nextArrayItem = <T>(array: T[], index: number): T => {
    return array[(index + 1) % array.length];
};

export const previousArrayItem = <T>(array: T[], index: number): T => {
    return array[(index + array.length - 1) % array.length];
};

export const getAllNested = <T>(
    item: T,
    childAccessor: (item: T) => T[]
): T[] => {
    const result: T[] = [];
    const stack: T[] = [item];

    while (stack.length > 0) {
        const currentItem = stack.pop()!;
        result.push(currentItem);

        const children = childAccessor(currentItem);
        stack.push(...children);
    }

    return result;
};

export const literalKeysToString = (
    object: Record<string, number | string>
): Record<string, string> => {
    for (const key of Object.keys(object)) {
        object[key] = String(object[key]);
    }

    return object as Record<string, string>;
};

export const bound2D = (points: Point2[]): Point2[] => {
    const xArray = points.map(p => {
        if (Array.isArray(p)) return p[0];
        return p.x;
    });
    const yArray = points.map(p => {
        if (Array.isArray(p)) return p[1];
        return p.y;
    });

    return [
        [Math.min(...xArray), Math.min(...yArray)],
        [Math.max(...xArray), Math.min(...yArray)],
        [Math.max(...xArray), Math.max(...yArray)],
        [Math.min(...xArray), Math.max(...yArray)],
    ];
};

export function createObservableArray<T>(
    onChange: (array: T[], operation: string, ...args: any[]) => void
): T[] {
    const mutatingMethods = new Set([
        "push",
        "pop",
        "shift",
        "unshift",
        "splice",
        // "sort",
        // "reverse",
        "fill",
        "copyWithin",
    ]);

    let isMethodExecuting = false;

    const proxy = new Proxy([], {
        // Triggers for direct property assignments like array[0] = 5 or array.length = 10
        set(target: T[], property: string | symbol, value: any): boolean {
            const oldValue = target[property as keyof T[]];
            const result = Reflect.set(target, property, value); // Target updated here

            // Only trigger onChange for numeric indices (actual array elements)
            if (
                typeof property === "string" &&
                /^\d+$/.test(property) &&
                !isMethodExecuting
            ) {
                onChange(
                    target,
                    "set",
                    Number.parseInt(property),
                    value,
                    oldValue
                );
            }

            return result;
        },

        // Triggers for array methods like push(), pop(), splice(), etc.
        get(target: T[], property: string | symbol): unknown {
            const value: unknown = Reflect.get(target, property);

            // If it's a mutating method, wrap it to call onChange after execution
            if (typeof property === "string" && mutatingMethods.has(property)) {
                return function (this: T[], ...args: unknown[]) {
                    isMethodExecuting = true;
                    const result = (
                        Array.prototype[property as keyof T[]] as (
                            ...args: unknown[]
                        ) => unknown
                    ).apply(this, args); // Target updated here
                    isMethodExecuting = false;
                    onChange(this, property, ...args);
                    return result;
                };
            }

            // For non-mutating methods and properties, return as-is
            return value;
        },

        deleteProperty(target: T[], property: string | symbol): boolean {
            const oldValue = target[property as keyof T[]];
            const result = Reflect.deleteProperty(target, property);

            if (typeof property === "string" && /^\d+$/.test(property)) {
                onChange(target, "delete", Number.parseInt(property), oldValue);
            }

            return result;
        },
    });

    return proxy;
}
