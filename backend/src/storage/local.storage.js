import fs from "fs/promises";
import path from "path";

const UPLOAD_DIR = "C:/Users/emanb/Desktop/LittleDung/temporary/";

export const localStorage = {
  async uploadImage(buffer, key) {
    const fullPath = path.join(UPLOAD_DIR, key);

    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, buffer);

    return `http://localhost:3000/uploads/${key}`;
  }
};