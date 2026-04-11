// apps/api/src/services/StorageService.ts

import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME!;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL!;

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

export class StorageService {
  /**
   * Sube un buffer al bucket y devuelve la URL pública
   */
  async upload(
    key: string,
    buffer: Buffer,
    mimeType: string
  ): Promise<string> {
    const upload = new Upload({
      client,
      params: {
        Bucket: R2_BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      },
    });

    await upload.done();
    return `${R2_PUBLIC_URL}/${key}`;
  }

  /**
   * Elimina un archivo del bucket a partir de su URL pública
   */
  async deleteByUrl(url: string): Promise<void> {
    if (!url || !url.startsWith(R2_PUBLIC_URL)) return;
    const key = url.replace(`${R2_PUBLIC_URL}/`, '');
    await this.deleteByKey(key);
  }

  /**
   * Elimina un archivo del bucket a partir de su key
   */
  async deleteByKey(key: string): Promise<void> {
    await client.send(
      new DeleteObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
      })
    );
  }
}

export const storageService = new StorageService();
