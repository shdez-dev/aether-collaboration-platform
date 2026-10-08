// apps/web/src/components/comments/CommentList.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { CommentItem } from './CommentItem';
import { CommentForm } from './CommentForm';
import { useComments } from '@/hooks/useComment';
import { es } from '@/lib/i18n';
import { MessageSquare, RefreshCw } from 'lucide-react';
import { C } from '@/lib/colors';
import { apiService } from '@/services/apiService';
import type { MentionCandidate } from './CommentForm';

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
  const { comments, count, isLoading, loadError, isCreating, createComment, updateComment, deleteComment, refreshComments } = useComments(cardId);
  const t = es;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [mentionCandidates, setMentionCandidates] = useState<MentionCandidate[]>([]);

  useEffect(() => {
    let cancelled = false;
    setMentionCandidates([]);
    apiService.get<{ users: MentionCandidate[] }>(`/api/cards/${cardId}/mentions`, true)
      .then((response) => { if (!cancelled) setMentionCandidates(response.success ? response.data?.users ?? [] : []); })
      .catch(() => { if (!cancelled) setMentionCandidates([]); });
    return () => { cancelled = true; };
  }, [cardId]);

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
      {loadError && <div role="alert" style={{ padding: '10px 12px', borderRadius: 8, background: `${C.red}12`, color: C.red, fontSize: 12 }}>
        No se pudieron cargar los comentarios: {loadError}{' '}
        <button type="button" onClick={refreshComments} style={{ border: 0, background: 'none', color: C.red, fontWeight: 700, cursor: 'pointer' }}>Reintentar</button>
      </div>}
      {comments.length === 0 && !loadError && (
        <p style={{ margin: 0, padding: '8px 2px', fontSize: 12.5, color: C.text4 }}>{t.comments_empty_title}. {t.comments_empty_desc}</p>
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
              mentionCandidates={mentionCandidates}
            />
          ))}
        </div>
      )}

      {/* New comment form */}
      {showForm && (
        <div style={{ paddingTop: '14px', borderTop: `1px solid ${C.border}` }}>
          <CommentForm
            onSubmit={async (content, mentions, documentReference) => {
              const created = await createComment(content, mentions, documentReference);
              if (!created) throw new Error('No se pudo publicar el comentario');
            }}
            isLoading={isCreating}
            placeholder={comments.length === 0 ? t.comments_first_placeholder : t.comments_add_placeholder}
            workspaceId={workspaceId}
            mentionCandidates={mentionCandidates}
            cardId={cardId}
          />
        </div>
      )}
    </div>
  );
}
