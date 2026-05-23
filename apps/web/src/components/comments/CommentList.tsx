// apps/web/src/components/comments/CommentList.tsx
'use client';

import { useEffect, useRef } from 'react';
import { CommentItem } from './CommentItem';
import { CommentForm } from './CommentForm';
import { useComments } from '@/hooks/useComment';
import { useT } from '@/lib/i18n';
import { MessageSquare, RefreshCw } from 'lucide-react';
import { C } from '@/lib/colors';

interface CommentListProps {
  cardId: string;
  maxHeight?: string;
  minHeight?: string;
  showForm?: boolean;
  showCount?: boolean;
  onCountChange?: (count: number) => void;
  workspaceId?: string;
}

export function CommentList({
  cardId,
  maxHeight = '400px',
  minHeight,
  showForm = true,
  showCount = true,
  onCountChange,
  workspaceId,
}: CommentListProps) {
  const { comments, count, isLoading, isCreating, createComment, updateComment, deleteComment, refreshComments } = useComments(cardId);
  const t = useT();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (onCountChange) onCountChange(count);
  }, [count, onCountChange]);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '160px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: `2px solid ${C.accent}`, borderTopColor: 'transparent', animation: 'spin 0.6s linear infinite' }} />
          <span style={{ fontSize: '12px', color: C.text4 }}>{t.comments_loading}</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Header */}
      {showCount && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <MessageSquare style={{ width: '13px', height: '13px', color: C.text4 }} />
            <span style={{ fontSize: '11px', fontWeight: 600, color: C.text3 }}>{t.comments_section_title}</span>
            <span style={{ fontSize: '11px', color: C.text4 }}>({count})</span>
          </div>
          {comments.length > 0 && (
            <button
              onClick={refreshComments}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '5px', fontSize: '11px', color: C.text4, background: 'transparent', border: 'none', cursor: 'pointer' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = C.text2; e.currentTarget.style.background = C.hover; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = C.text4; e.currentTarget.style.background = 'transparent'; }}
              title={t.btn_refresh}
            >
              <RefreshCw style={{ width: '10px', height: '10px' }} />
            </button>
          )}
        </div>
      )}

      {/* Empty state */}
      {comments.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '28px 16px', borderRadius: '8px', border: `1px dashed ${C.border}`, gap: '6px' }}>
          <MessageSquare style={{ width: '22px', height: '22px', color: C.text4, opacity: 0.5 }} />
          <p style={{ fontSize: '12.5px', color: C.text4, margin: 0 }}>{t.comments_empty_title}</p>
          <p style={{ fontSize: '11px', color: C.text4, opacity: 0.7, margin: 0 }}>{t.comments_empty_desc}</p>
        </div>
      )}

      {/* Comment list */}
      {comments.length > 0 && (
        <div
          ref={scrollRef}
          style={{ maxHeight, minHeight: minHeight || 'auto', overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column', gap: '2px', paddingRight: '2px' }}
        >
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              onUpdate={updateComment}
              onDelete={deleteComment}
              showActions={true}
            />
          ))}
        </div>
      )}

      {/* New comment form */}
      {showForm && (
        <div style={{ paddingTop: '10px', borderTop: `1px solid ${C.border}` }}>
          <CommentForm
            onSubmit={async (content, mentions) => { await createComment(content, mentions); }}
            isLoading={isCreating}
            placeholder={comments.length === 0 ? t.comments_first_placeholder : t.comments_add_placeholder}
            workspaceId={workspaceId}
          />
        </div>
      )}
    </div>
  );
}
