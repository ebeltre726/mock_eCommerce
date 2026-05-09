import pino from 'pino';
import { AsyncLocalStorage } from 'async_hooks';

// Stores { traceId } for the current async request context.
// Any code that imports `traceStore` can read the current traceId without
// it being explicitly threaded through every function call.
export const traceStore = new AsyncLocalStorage();

const base = pino({
    level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
    base: { service: 'furnituria-api' },
    ...(process.env.NODE_ENV !== 'production' && {
        transport: {
            target: 'pino-pretty',
            options: { colorize: true, translateTime: 'SYS:standard' },
        },
    }),
});

// Proxy so that every log call automatically injects the current traceId
// without callers needing to hold a reference to a per-request child logger.
const logger = new Proxy(base, {
    get(target, prop) {
        if (['info', 'warn', 'error', 'debug', 'fatal', 'trace'].includes(prop)) {
            return (...args) => {
                const ctx = traceStore.getStore();
                if (ctx?.traceId) {
                    const child = target.child({ traceId: ctx.traceId });
                    return child[prop](...args);
                }
                return target[prop](...args);
            };
        }
        return typeof target[prop] === 'function' ? target[prop].bind(target) : target[prop];
    },
});

export default logger;
