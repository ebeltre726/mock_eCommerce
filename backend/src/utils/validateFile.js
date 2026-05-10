import { fileTypeFromBuffer } from 'file-type';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_SIZE = 5 * 1024 * 1024;

// Validates both the Content-Type header (fast reject) and the actual file
// magic bytes (defense-in-depth against spoofed Content-Type headers).
export async function validateFile(file) {
    if (!file) throw new Error('File missing');

    if (file.size > MAX_SIZE) throw new Error('File too large');

    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
        throw new Error('Invalid file type');
    }

    const detected = await fileTypeFromBuffer(file.buffer);
    if (!detected || !ALLOWED_MIME_TYPES.has(detected.mime)) {
        throw new Error('Invalid file type');
    }
}