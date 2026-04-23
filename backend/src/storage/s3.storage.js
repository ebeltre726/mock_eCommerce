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

function objectUrl(bucket, key) {
    if (process.env.S3_ENDPOINT) {
        return `${process.env.S3_ENDPOINT}/${bucket}/${key}`;
    }
    return `https://${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
}

export const s3Storage = {
    async uploadImage(buffer, key, contentType = 'image/webp', bucket = process.env.S3_BUCKET_AVATARS) {
        await s3.send(new PutObjectCommand({
            Bucket:      bucket,
            Key:         key,
            Body:        buffer,
            ContentType: contentType,
        }));
        return objectUrl(bucket, key);
    },

    async getUploadUrl({ key, contentType, bucket = process.env.S3_BUCKET_AVATARS }) {
        const command = new PutObjectCommand({
            Bucket:      bucket,
            Key:         key,
            ContentType: contentType,
        });
        const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 60 });
        return { uploadUrl, fileUrl: objectUrl(bucket, key) };
    },
};