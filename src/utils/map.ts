export const putIfAbsent = <K, V>(map: Map<K, V>, key: K, value: V): V => {
    const existingValue = map.get(key);
    if (!existingValue) {
        map.set(key, value);
        return value;
    }

    return existingValue;
};
