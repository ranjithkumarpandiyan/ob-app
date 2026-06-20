/**
 * ob-events
 * Internal in-process event bus. Thin wrapper over Node's EventEmitter.
 * Use for decoupled side-effects within a single process.
 *
 * For cross-service events, use ob-queue (async jobs) or Redis pub/sub.
 *
 * Usage:
 *   import events from 'ob-events'
 *
 *   // Publish
 *   events.emit('user.created', { id, email })
 *
 *   // Subscribe
 *   events.on('user.created', async (data) => { ... })
 *
 *   // One-time
 *   events.once('order.paid', handler)
 *
 *   // Remove
 *   events.off('user.created', handler)
 */

import { EventEmitter } from 'events';

class OgEvents extends EventEmitter {
    constructor() {
        super();
        // Raise the default limit — each module may add multiple listeners
        this.setMaxListeners(50);
    }

    /**
   * Emit an event. Always async-safe — errors in listeners are caught
   * and emitted as 'error' so they don't crash the process silently.
   */
    emit(event, ...args) {
        try {
            return super.emit(event, ...args);
        } catch (err) {
            super.emit('error', err);
            return false;
        }
    }

    /**
   * Subscribe to an event with an async handler.
   * Errors from async handlers are caught and re-emitted as 'error'.
   */
    on(event, handler) {
        const wrapped = (...args) => {
            const result = handler(...args);
            if (result instanceof Promise) {
                result.catch((err) => this.emit('error', err));
            }
        };
        // Store reference so off() works with the original function
        wrapped._original = handler;
        return super.on(event, wrapped);
    }

    /**
   * Remove a listener added via on(). Matches by original function reference.
   */
    off(event, handler) {
        const listeners = this.rawListeners(event);
        for (const wrapped of listeners) {
            if (wrapped._original === handler || wrapped === handler) {
                this.removeListener(event, wrapped);
                break;
            }
        }
        return this;
    }

    /**
   * List all registered event names.
   */
    registeredEvents() {
        return this.eventNames();
    }
}

const events = new OgEvents();

// Default error handler to avoid unhandled 'error' event crash.
// console is intentional here — ob-events has no logger dependency by design.
events.on('error', (err) => {
    /* eslint-disable-next-line no-console -- ob-events must not depend on ob-logger; console is the only safe fallback */
    console.error('[ob-events] Unhandled event error:', err);
});

export default events;
export { OgEvents };
