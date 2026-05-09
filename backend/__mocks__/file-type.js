// Jest manual mock — replaces the pure-ESM file-type package in CJS test runs.
// Returns a valid JPEG signature by default; individual tests can override via
// jest.mock('file-type', ...) or jest.spyOn.
module.exports = {
    fileTypeFromBuffer: jest.fn(async () => ({ mime: 'image/jpeg', ext: 'jpg' })),
};
