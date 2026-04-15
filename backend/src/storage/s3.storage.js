// storage/s3.storage.js
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  endpoint: process.env.S3_ENDPOINT,       // set for MinIO locally, unset for real AWS
  forcePathStyle: true,                     // required for MinIO & path-style AWS
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

function objectUrl(key) {
  // MinIO (local):  http://localhost:9000/<bucket>/<key>
  // Real AWS:       https://<bucket>.s3.<region>.amazonaws.com/<key>
  if (process.env.S3_ENDPOINT) {
    return `${process.env.S3_ENDPOINT}/${process.env.S3_BUCKET}/${key}`;
  }
  return `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
}

export const s3Storage = {
  async uploadImage(buffer, key, contentType = "image/webp") {
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    );
    return objectUrl(key);
  },

  async getUploadUrl({ key, contentType }) {
    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      ContentType: contentType,
    });
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 60 });
    return { uploadUrl, fileUrl: objectUrl(key) };
  },
};