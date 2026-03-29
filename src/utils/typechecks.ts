export const isString = (value: any): boolean =>
    typeof value === "string" || value instanceof String;

type Primitive = string | number | boolean;
type ObjectL = Record<string, unknown>;
type Array_ = any[];
type Any = Primitive | ObjectL | Array_ | undefined;

export const typeGuardPrimitive = (value: Any): value is Primitive => {
    return (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
    );
};

export const typeGuardObjectL = (value: Any): value is ObjectL => {
    return typeof value === "object" && value.constructor === Object;
};

export const typeGuardByProperty = <T>(
    value: any,
    property: keyof T
): value is T => {
    return value != null && property in value;
};

export const typeGuardByCondition = <T>(
    value: any,
    condition: boolean
): value is T => {
    return condition;
};
