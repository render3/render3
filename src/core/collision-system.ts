import type { Model } from "../scene/model";
import { EventEmitter } from "./event-emitter";

export type CollisionEvents = {
    collision: CollisionEvent;
};

export type CollisionEvent = {
    collisionId: number;
    models: [Model, Model];

    // TODO post-mvp
    // contact: Plane; // (contact point + contact normal)
    // velocity: Vector3;
    // depth?: number;
};
export type CollisionListener = (event: CollisionEvent) => void;

export class CollisionEmitter extends EventEmitter<CollisionEvents> {
    private last: CollisionEvent | undefined;

    override emit(event: "collision", message: CollisionEvent) {
        // Distinct until changed
        // All parents of two models colliding will emit two events (A,B and B,A), so we filter to emit only A,B
        if (
            message.collisionId === this.last?.collisionId &&
            message.models.every(m => this.last?.models.includes(m))
        ) {
            return false;
        }

        this.last = message;
        return super.emit(event, message);
    }
}
