import crypto from 'crypto';

const ENCRYPTED_PREFIX = 'enc:';

function getEncryptionKey(): Buffer {
  const source = process.env.SECRETS_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!source) {
    throw new Error('Missing encryption secret');
  }
  return crypto.createHash('sha256').update(source).digest();
}

export function encryptSecret(value: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENCRYPTED_PREFIX}${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function decryptSecret(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith(ENCRYPTED_PREFIX)) return value;

  const payload = value.slice(ENCRYPTED_PREFIX.length);
  const [ivPart, tagPart, encryptedPart] = payload.split('.');
  if (!ivPart || !tagPart || !encryptedPart) {
    throw new Error('Malformed encrypted secret');
  }

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    Buffer.from(ivPart, 'base64url')
  );
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, 'base64url')),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}
