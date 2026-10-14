import { verifiedAvatarExtension } from './avatarFile';

describe('verifiedAvatarExtension', () => {
  it.each([
    ['image/jpeg', Buffer.from([0xff, 0xd8, 0xff, 0x00]), '.jpg'],
    ['image/jpg', Buffer.from([0xff, 0xd8, 0xff, 0x00]), '.jpg'],
    ['image/png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), '.png'],
    ['image/gif', Buffer.from('GIF89a'), '.gif'],
    ['image/webp', Buffer.from('RIFF0000WEBP'), '.webp'],
  ])('accepts valid %s bytes', (mimeType, bytes, extension) => {
    expect(verifiedAvatarExtension(mimeType, bytes)).toBe(extension);
  });

  it('rejects HTML disguised as an image', () => {
    expect(verifiedAvatarExtension('image/png', Buffer.from('<script>alert(1)</script>'))).toBeNull();
  });

  it('rejects mismatched image types', () => {
    expect(verifiedAvatarExtension('image/png', Buffer.from('GIF89a'))).toBeNull();
  });
});
