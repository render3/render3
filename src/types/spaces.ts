export const Space = {
    LOCAL: 0,
    WORLD: 1,
    EYE: 2,
    PROJECTION: 3,
    CLIP: 4,
    NDC: 5,
    SCREEN: 6,
} as const;

export type SpaceKey = keyof typeof Space;
export type SpaceValue = (typeof Space)[SpaceKey];
