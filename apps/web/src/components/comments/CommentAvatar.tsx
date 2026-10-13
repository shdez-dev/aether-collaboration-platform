'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getAvatarUrl, getInitials } from '@/lib/utils/avatar';

const PALETTE = ['#6176B5', '#249B84', '#9872BA', '#B1774D', '#B45D85', '#4D91A2'];

function colorFor(name: string) {
  let value = 0;
  for (const character of name) value = (value * 31 + character.charCodeAt(0)) | 0;
  return PALETTE[Math.abs(value) % PALETTE.length];
}

export function CommentAvatar({ name, avatar, size = 30 }: { name: string; avatar?: string | null; size?: number }) {
  const avatarUrl = getAvatarUrl(avatar);
  return (
    <Avatar style={{ width: size, height: size, flexShrink: 0 }}>
      {avatarUrl && <AvatarImage src={avatarUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
      <AvatarFallback style={{ width: '100%', height: '100%', background: colorFor(name), color: '#fff', fontSize: size < 30 ? 10 : 11, fontWeight: 700 }}>
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
