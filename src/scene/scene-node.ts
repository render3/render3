import {
    CollisionEmitter,
    type CollisionEvent,
    type CollisionListener,
} from "../core/collision-system";

export abstract class SceneNode<
    T extends SceneNode<T>,
    P extends SceneNode<P> = any,
    C extends SceneNode<C> = any
> {
    readonly children: C[] = [];
    parent: P | undefined;
    private readonly collisionEmitter = new CollisionEmitter();

    constructor(public id?: string) {}

    add(...children: C[]): this {
        this.children.push(...children);
        for (const child of children) {
            child.parent = this;
        }

        return this;
    }

    remove(...children: C[]): this {
        for (const child of children) {
            const index = this.children.indexOf(child);
            this.children.splice(index, 1);
            child.parent = undefined;
        }

        return this;
    }

    clear(): this {
        for (const child of this.children) {
            this.remove(child);
        }

        return this;
    }

    removeFromParent(): this {
        this.parent?.remove(this);
        this.parent = undefined;

        return this;
    }

    on(event: "collision", listener: CollisionListener) {
        this.collisionEmitter.on(event, listener);
        return () => {
            this.off("collision", listener);
        };
    }

    once(event: "collision", listener: CollisionListener) {
        this.collisionEmitter.once(event, listener);
    }

    off(event: "collision", listener: CollisionListener) {
        this.collisionEmitter.off(event, listener);
    }

    emit(event: "collision", message: CollisionEvent) {
        this.collisionEmitter.emit(event, message); // Call this node's listeners
        this.parent?.emit(event, message); // Then traverse up
    }
}
