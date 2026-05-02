// storage/index.js
import { s3Storage } from "./s3.storage.js";

// s3Storage works for both local MinIO and production AWS.
// The only difference is the env vars — no code change needed at deploy time.
export const storage = s3Storage;