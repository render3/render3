export type DeepMerge = {
    [key: string]: string | number | DeepMerge | undefined;
};

export const deepMerge = (
    target: DeepMerge,
    ...sources: DeepMerge[]
): DeepMerge => {
    if (sources.length === 0) {
        return target;
    }

    const source = sources.shift()!;

    if (isObject(target) && isObject(source)) {
        for (const [key, sourceValue] of Object.entries(source)) {
            if (isObject(sourceValue)) {
                if (!target[key])
                    Object.assign(target, {
                        [key]: {},
                    });
                deepMerge(target[key] as DeepMerge, sourceValue as DeepMerge);
            } else {
                target[key] = sourceValue;
            }
        }
    }

    return deepMerge(target, ...sources);
};

const isObject = (item: any): boolean => {
    return Object.getPrototypeOf(item) === Object.prototype;
};
