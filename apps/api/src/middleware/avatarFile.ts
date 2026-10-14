const avatarTypes = {
  'image/jpeg': { extension: '.jpg', matches: (buffer: Buffer) => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff },
  'image/png': { extension: '.png', matches: (buffer: Buffer) => buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  'image/gif': { extension: '.gif', matches: (buffer: Buffer) => buffer.length >= 6 && ['GIF87a', 'GIF89a'].includes(buffer.toString('ascii', 0, 6)) },
  'image/webp': { extension: '.webp', matches: (buffer: Buffer) => buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP' },
} as const;

export function verifiedAvatarExtension(mimeType: string, buffer: Buffer): string | null {
  const normalizedType = mimeType === 'image/jpg' ? 'image/jpeg' : mimeType;
  const imageType = avatarTypes[normalizedType as keyof typeof avatarTypes];
  return imageType?.matches(buffer) ? imageType.extension : null;
}
