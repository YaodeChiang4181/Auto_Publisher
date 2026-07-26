import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';
import path from 'path';

// Parse endpoint config
const endpoint = process.env.S3_ENDPOINT;
const accessKeyId = process.env.S3_ACCESS_KEY_ID;
const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
const bucketName = process.env.S3_BUCKET_NAME;
const publicDomain = process.env.S3_PUBLIC_DOMAIN;

let s3Client: S3Client | null = null;

if (endpoint && accessKeyId && secretAccessKey) {
  s3Client = new S3Client({
    region: 'auto', // R2 allows 'auto' or 'us-east-1'
    endpoint: endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

/**
 * 上傳檔案到 S3/R2 並回傳公開網址
 * @param fileBuffer 檔案二進制內容
 * @param filename 原始檔案名稱
 * @param contentType 檔案的 MIME 型別 (e.g., image/jpeg)
 * @returns 檔案的公開網址 (URL)
 */
export async function uploadToS3(fileBuffer: Buffer, filename: string, contentType: string): Promise<string> {
  if (!s3Client || !bucketName || !publicDomain) {
    throw new Error('S3/R2 configuration is missing in environment variables.');
  }

  // 產生唯一檔名避免衝突
  const ext = path.extname(filename);
  const uniqueId = crypto.randomBytes(8).toString('hex');
  const objectKey = `media/${Date.now()}-${uniqueId}${ext}`;

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: objectKey,
    Body: fileBuffer,
    ContentType: contentType,
  });

  await s3Client.send(command);

  // 回傳公開可存取的 URL
  // 移除網址結尾的斜線，確保拼接正確
  const baseUrl = publicDomain.endsWith('/') ? publicDomain.slice(0, -1) : publicDomain;
  return `${baseUrl}/${objectKey}`;
}
