// apps/api/src/services/StorageService.ts

import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const storageDriver = process.env.STORAGE_DRIVER || 'r2';
const localStorageDir = path.resolve(process.env.LOCAL_STORAGE_DIR || 'apps/api/public/uploads');
const localStoragePublicUrl = (process.env.LOCAL_STORAGE_PUBLIC_URL || '').replace(/\/$/, '');
const r2PublicUrl = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');
let r2Client: S3Client | undefined;

function getR2Client(): S3Client {
  if (r2Client) return r2Client;

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('R2 storage is missing its credentials');
  }

  r2Client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  return r2Client;
}

function resolveLocalKey(key: string): string {
  const normalizedKey = key.replace(/\\/g, '/').replace(/^\/+/, '');
  const resolvedPath = path.resolve(localStorageDir, normalizedKey);
  if (resolvedPath !== localStorageDir && !resolvedPath.startsWith(`${localStorageDir}${path.sep}`)) {
    throw new Error('Invalid storage key');
  }
  return resolvedPath;
}

export class StorageService {
  /**
   * Sube un buffer al bucket y devuelve la URL pública
   */
  async upload(
    key: string,
    buffer: Buffer,
    mimeType: string
  ): Promise<string> {
    if (storageDriver === 'local') {
      if (!localStoragePublicUrl) throw new Error('LOCAL_STORAGE_PUBLIC_URL is required for local storage');
      const filePath = resolveLocalKey(key);
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, buffer, { flag: 'w' });
      return `${localStoragePublicUrl}/${key.split('/').map(encodeURIComponent).join('/')}`;
    }

    const bucketName = process.env.R2_BUCKET_NAME;
    if (!bucketName || !r2PublicUrl) throw new Error('R2 storage is missing its configuration');
    await getR2Client().send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      })
    );
    return `${r2PublicUrl}/${key}`;
  }

  /**
   * Elimina un archivo del bucket a partir de su URL pública
   */
  async deleteByUrl(url: string): Promise<void> {
    const publicUrl = storageDriver === 'local' ? localStoragePublicUrl : r2PublicUrl;
    if (!url || !publicUrl || !url.startsWith(`${publicUrl}/`)) return;
    const encodedKey = url.slice(publicUrl.length + 1);
    const key = encodedKey.split('/').map((part) => {
      try {
        return decodeURIComponent(part);
      } catch {
        return part;
      }
    }).join('/');
    await this.deleteByKey(key);
  }

  /**
   * Elimina un archivo del bucket a partir de su key
   */
  async deleteByKey(key: string): Promise<void> {
    if (storageDriver === 'local') {
      await rm(resolveLocalKey(key), { force: true });
      return;
    }

    const bucketName = process.env.R2_BUCKET_NAME;
    if (!bucketName) throw new Error('R2 storage is missing its configuration');
    await getR2Client().send(
      new DeleteObjectCommand({
        Bucket: bucketName,
        Key: key,
      })
    );
  }
}

export const storageService = new StorageService();
