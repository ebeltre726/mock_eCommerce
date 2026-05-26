import { handler } from '../src/background/orderProcessor.js';

const result = await handler();
console.log('[runOrderProcessor] done:', result);
process.exit(0);
