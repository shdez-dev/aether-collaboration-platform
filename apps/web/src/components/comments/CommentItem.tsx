// apps/web/src/components/comments/CommentItem.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { Edit2, Trash2, MoreVertical, Check } from 'lucide-react';
import { CommentForm } from './CommentForm';
import { useCommentEdit } from '@/hooks/useComment';
import { useAuthStore } from '@/stores/authStore';
import type { CommentWithUser } from '@aether/types';
import { useT } from '@/lib/i18n';
import { formatRelative } from '@/lib/utils/date';
import { C } from '@/lib/colors';

interface CommentItemProps {
  comment: CommentWithUser;
  onUpdate?: (commentId: string, content: string, mentions?: string[]) => Promise<void>;
  onDelete?: (commentId: string) => Promise<void>;
  showActions?: boolean;
}

const AVATAR_PALETTE = ['#3b82f6','#10b981','#f59e0b','#a855f7','#ec4899','#06b6d4','#fb923c','#84cc16'];
function hashColor(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}
function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

export function CommentItem({ comment, onUpdate, onDelete, showActions = true }: CommentItemProps) {
  const t = useT();
  const { user: currentUser } = useAuthStore();
  const { isEditing, isUpdating, startEdit, cancelEdit } = useCommentEdit(comment.id);
  const [isDeleting, setIsDeleting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isAuthor = currentUser?.id === comment.userId;

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const handleUpdate = async (content: string, mentions?: string[]) => {
    if (!onUpdate) return;
    await onUpdate(comment.id, content, mentions);
    cancelEdit();
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setMenuOpen(false);
    setIsDeleting(true);
    try { await onDelete(comment.id); } catch {} finally { setIsDeleting(false); }
  };

  const renderContent = (content: string) => {
    const parts = content.split(/(@\[[^\]]+\]|@[a-zA-Z0-9_-]+)/g);
    return parts.map((part, i) => {
      if (!part.startsWith('@')) return <span key={i}>{part}</span>;
      const name = part.startsWith('@[') ? part.slice(2, -1) : part.slice(1);
      return (
        <span key={i} style={{ color: C.accent, fontWeight: 500, textDecoration: 'underline', textUnderlineOffset: '2px', textDecorationColor: `${C.accent}60` }}>
          @{name}
        </span>
      );
    });
  };

  const getRelativeTime = (date: string) => formatRelative(date, currentUser?.language as 'es' | 'en') || date;

  if (isEditing) {
    return (
      <div style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${C.border2}`, background: C.bg2 }}>
        <CommentForm
          onSubmit={handleUpdate}
          initialValue={comment.content}
          isEditing={true}
          onCancel={cancelEdit}
          isLoading={isUpdating}
          autoFocus={true}
          submitText={t.btn_save}
        />
      </div>
    );
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative', display: 'flex', gap: '10px', padding: '10px',
        borderRadius: '8px', background: hovered ? C.hover : 'transparent',
        transition: 'background 0.12s',
      }}
    >
      {/* Avatar */}
      <div style={{
        width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0,
        background: hashColor(comment.user.name),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '11px', fontWeight: 700, color: '#fff',
      }}>
        {initials(comment.user.name)}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
          <span style={{ fontSize: '12.5px', fontWeight: 600, color: C.text }}>{comment.user.name}</span>
          <span style={{ fontSize: '11px', color: C.text4 }}>{getRelativeTime(comment.createdAt)}</span>
          {comment.edited && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10.5px', color: C.text4 }}>
              <Check style={{ width: '10px', height: '10px' }} />
              {t.comments_edited_badge}
            </span>
          )}
        </div>
        <div style={{ fontSize: '12.5px', color: C.text2, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {renderContent(comment.content)}
        </div>
      </div>

      {/* Action menu */}
      {showActions && isAuthor && !isDeleting && (hovered || menuOpen) && (
        <div ref={menuRef} style={{ position: 'relative', flexShrink: 0 }}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            style={{
              width: '26px', height: '26px', borderRadius: '5px', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              background: menuOpen ? C.hover : 'transparent', border: 'none', cursor: 'pointer', color: C.text4,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = C.hover; e.currentTarget.style.color = C.text2; }}
            onMouseLeave={(e) => { if (!menuOpen) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.text4; } }}
          >
            <MoreVertical style={{ width: '14px', height: '14px' }} />
          </button>

          {menuOpen && (
            <div style={{
              position: 'absolute', right: 0, top: '100%', marginTop: '4px',
              background: C.surface, border: `1px solid ${C.border2}`, borderRadius: '8px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)', minWidth: '130px', overflow: 'hidden', zIndex: 20,
            }}>
              <button
                onClick={() => { startEdit(); setMenuOpen(false); }}
                disabled={isUpdating}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', fontSize: '12px', color: C.text2, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = C.hover)}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
              >
                <Edit2 style={{ width: '12px', height: '12px' }} />
                {t.comments_dropdown_edit}
              </button>
              <div style={{ height: '1px', background: C.border, margin: '2px 0' }} />
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', fontSize: '12px', color: C.red, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = `${C.red}12`)}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
              >
                <Trash2 style={{ width: '12px', height: '12px' }} />
                {t.comments_dropdown_delete}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Deleting overlay */}
      {isDeleting && (
        <div style={{ position: 'absolute', inset: 0, borderRadius: '8px', background: `${C.bg}cc`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: `2px solid ${C.accent}`, borderTopColor: 'transparent', animation: 'spin 0.6s linear infinite' }} />
        </div>
      )}
    </div>
  );
}
