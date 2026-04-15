export function validateFile(file) {
  if (!file) throw new Error("File missing");

  const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];

  if (!allowed.includes(file.mimetype)) {
    throw new Error("Invalid file type");
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error("File too large");
  }
}