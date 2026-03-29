type Listener<T> = (payload: T) => void;

export class EventEmitter<Events extends Record<string, any>> {
    private readonly listeners = new Map<keyof Events, Array<Listener<any>>>();

    on<K extends keyof Events>(event: K, listener: Listener<Events[K]>): this {
        const eventListeners = this.listeners.get(event) ?? [];
        eventListeners.push(listener);
        this.listeners.set(event, eventListeners);
        return this;
    }

    once<K extends keyof Events>(
        event: K,
        listener: Listener<Events[K]>
    ): this {
        const listenerWrapper: Listener<Events[K]> = payload => {
            this.off(event, listenerWrapper);
            listener(payload);
        };

        return this.on(event, listenerWrapper);
    }

    off<K extends keyof Events>(event: K, listener: Listener<Events[K]>): this {
        const eventListeners = this.listeners.get(event);
        if (!eventListeners) return this;
        const listenerIndex = eventListeners.indexOf(listener);

        if (listenerIndex >= 0) {
            eventListeners.splice(listenerIndex, 1);
            if (eventListeners.length === 0) this.listeners.delete(event);
            else this.listeners.set(event, eventListeners);
        }

        return this;
    }

    emit<K extends keyof Events>(event: K, payload: Events[K]): boolean {
        const eventListeners = this.listeners.get(event);
        if (!eventListeners || eventListeners.length === 0) return false;

        for (const listener of eventListeners) {
            listener(payload);
        }

        return true;
    }
}
