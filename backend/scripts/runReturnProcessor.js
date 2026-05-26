import { handler } from '../src/background/returnProcessor.js';

const result = await handler();
console.log('[runReturnProcessor] done:', result);
process.exit(0);
