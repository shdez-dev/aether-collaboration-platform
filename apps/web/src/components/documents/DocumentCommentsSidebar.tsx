'use client';
// apps/web/src/components/documents/DocumentCommentsSidebar.tsx

import React, { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import {
  MessageSquare, X, Check, RotateCcw, Pencil, Trash2, Send,
  ChevronDown, ChevronRight, Reply,
} from 'lucide-react';
import {
  useDocumentCommentStore,
  selectDocumentComments,
  selectActiveCommentId,
  selectSidebarOpen,
  selectPendingSelection,
  type DocumentCommentData,
} from '@/stores/documentCommentStore';
import { useAuthStore } from '@/stores/authStore';
import { getAvatarUrl } from '@/lib/utils/avatar';
import { useT } from '@/lib/i18n';

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  bg:      '#0b0d10',
  bg2:     '#0f1117',
  surface: '#14171c',
  hover:   '#1c2128',
  border:  '#1f2329',
  border2: '#2a2f36',
  text:    '#e6e8eb',
  text2:   '#a1a7b0',
  text3:   '#6b7280',
  text4:   '#4b5260',
  accent:  '#3b82f6',
  green:   '#10b981',
  red:     '#ef4444',
  amber:   '#f59e0b',
};

// ─── Avatar ───────────────────────────────────────────────────────────────────

const AVATAR_HUE = ['#7c3aed','#4f46e5','#0284c7','#0d9488','#059669','#d97706','#dc2626','#db2777'];

function avatarBg(name: string) {
  return AVATAR_HUE[name.charCodeAt(0) % AVATAR_HUE.length];
}

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

function Avatar({ name, avatar, size = 28 }: { name: string; avatar?: string | null; size?: number }) {
  const [imgError, setImgError] = useState(false);
  const resolvedSrc = !imgError ? getAvatarUrl(avatar ?? null) : null;

  if (resolvedSrc) {
    return (
      <img
        src={resolvedSrc} alt={name}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: `1px solid ${C.border2}` }}
        onError={() => setImgError(true)}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: avatarBg(name), color: '#fff',
      fontSize: size * 0.38, fontWeight: 700,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      userSelect: 'none',
    }}>
      {initials(name)}
    </div>
  );
}

// ─── RelativeTime ─────────────────────────────────────────────────────────────

function RelativeTime({ iso }: { iso: string }) {
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days  = Math.floor(hours / 24);
  const label =
    mins  < 1  ? 'ahora'
    : mins  < 60 ? `${mins}m`
    : hours < 24 ? `${hours}h`
    : days  < 7  ? `${days}d`
    : new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

  return <time style={{ fontSize: '10.5px', color: C.text4, lineHeight: 1 }} dateTime={iso}>{label}</time>;
}

// ─── Mentions ─────────────────────────────────────────────────────────────────

function Mentions({ text }: { text: string }) {
  const parts = text.split(/(@\[[^\]]+\]|@\w+)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (!p.startsWith('@')) return <React.Fragment key={i}>{p}</React.Fragment>;
        const name = p.startsWith('@[') ? p.slice(2, -1) : p.slice(1);
        return (
          <span key={i} style={{ color: C.accent, fontWeight: 500, textDecoration: 'underline', textDecorationColor: `${C.accent}60` }}>
            @{name}
          </span>
        );
      })}
    </>
  );
}

// ─── MentionTextarea ──────────────────────────────────────────────────────────

interface MentionTextareaProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onMentionSelected?: (memberId: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  members?: { id: string; name: string; avatar?: string | null }[];
}

function MentionTextarea({ value, onChange, onSubmit, onMentionSelected, placeholder, autoFocus, members = [] }: MentionTextareaProps) {
  const ref         = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState(0);
  const [activeIndex, setActiveIndex]   = useState(0);
  const [focused, setFocused]           = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  useEffect(() => { setActiveIndex(0); }, [mentionQuery]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    onChange(v);
    const cursor = e.target.selectionStart ?? 0;
    const match  = v.slice(0, cursor).match(/@([^@]*)$/);
    if (match) { setMentionQuery(match[1]); setMentionStart(cursor - match[0].length); }
    else setMentionQuery(null);
  };

  const insertMention = (name: string) => {
    const member = members.find((mb) => mb.name === name);
    if (member) onMentionSelected?.(member.id);
    const el  = ref.current;
    const cur = el ? (el.selectionStart ?? mentionStart + name.length + 1) : mentionStart + name.length + 1;
    const before  = value.slice(0, mentionStart);
    const after   = value.slice(cur);
    const mention = `@[${name}] `;
    onChange(before + mention + after);
    setMentionQuery(null);
    setTimeout(() => { if (el) { const p = (before + mention).length; el.focus(); el.setSelectionRange(p, p); } }, 0);
  };

  const filtered = mentionQuery !== null
    ? members.filter((m) => m.name.toLowerCase().includes(mentionQuery!.toLowerCase())).slice(0, 6)
    : [];

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); onSubmit(); return; }
    if (e.key === 'Escape') { setMentionQuery(null); return; }
    if (mentionQuery !== null && filtered.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => (i + 1) % filtered.length); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIndex((i) => (i - 1 + filtered.length) % filtered.length); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insertMention(filtered[activeIndex].name); return; }
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <textarea
        ref={ref}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder ?? 'Escribe un comentario...'}
        autoFocus={autoFocus}
        rows={2}
        style={{
          width: '100%', resize: 'none', padding: '8px 10px',
          background: C.bg2, border: `1px solid ${focused ? C.accent : C.border}`,
          borderRadius: '7px', color: C.text, fontSize: '12.5px',
          outline: 'none', transition: 'border-color 0.15s',
          minHeight: '52px', maxHeight: '160px', boxSizing: 'border-box',
          lineHeight: 1.5,
        }}
      />
      {filtered.length > 0 && (
        <div
          ref={dropdownRef}
          onMouseDown={(e) => e.preventDefault()}
          style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 9999,
            width: '200px', background: C.surface, border: `1px solid ${C.border2}`,
            borderRadius: '9px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            overflow: 'hidden', padding: '4px',
          }}
        >
          <p style={{ fontSize: '10px', color: C.text4, textTransform: 'uppercase', letterSpacing: '0.07em', padding: '4px 10px 6px' }}>
            Mencionar usuario
          </p>
          {filtered.map((m, idx) => (
            <button
              key={m.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); insertMention(m.name); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                width: '100%', padding: '6px 10px', borderRadius: '6px',
                background: idx === activeIndex ? `${C.accent}18` : 'transparent',
                border: 'none', color: idx === activeIndex ? C.accent : C.text2,
                cursor: 'pointer', fontSize: '12.5px', textAlign: 'left',
              }}
            >
              <Avatar name={m.name} avatar={m.avatar} size={20} />
              <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── CommentForm ──────────────────────────────────────────────────────────────

interface CommentFormProps {
  onSubmit: (content: string, mentions: string[]) => Promise<void>;
  onCancel?: () => void;
  placeholder?: string;
  submitLabel?: string;
  autoFocus?: boolean;
  initialValue?: string;
  members?: { id: string; name: string; avatar?: string | null }[];
  t: any;
}

function CommentForm({ onSubmit, onCancel, placeholder, submitLabel = 'Comentar', autoFocus, initialValue = '', members = [], t: translations }: CommentFormProps) {
  const [content,    setContent]    = useState(initialValue);
  const [submitting, setSubmitting] = useState(false);
  const mentionIdsRef = useRef<Set<string>>(new Set());

  const handle = async () => {
    const text = content.trim();
    if (!text) return;
    setSubmitting(true);
    try {
      await onSubmit(text, Array.from(mentionIdsRef.current));
      setContent('');
      mentionIdsRef.current = new Set();
    } finally { setSubmitting(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <MentionTextarea
        value={content} onChange={setContent} onSubmit={handle}
        onMentionSelected={(id) => mentionIdsRef.current.add(id)}
        placeholder={placeholder} autoFocus={autoFocus} members={members}
      />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <span style={{ fontSize: '11px', color: C.text4 }}>⌘↵ enviar · @mencionar</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {onCancel && (
            <button type="button" onClick={onCancel} style={{
              padding: '4px 10px', borderRadius: '6px', fontSize: '12px',
              background: 'transparent', border: 'none', color: C.text3, cursor: 'pointer',
            }}>
              {translations.btn_cancel}
            </button>
          )}
          <button
            type="button" onClick={handle}
            disabled={!content.trim() || submitting}
            style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 500,
              background: C.accent, color: '#fff', border: 'none',
              cursor: !content.trim() || submitting ? 'not-allowed' : 'pointer',
              opacity: !content.trim() || submitting ? 0.45 : 1, transition: 'opacity 0.12s',
            }}
          >
            <Send style={{ width: '11px', height: '11px' }} />
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ReplyItem ────────────────────────────────────────────────────────────────

function ReplyItem({ reply, currentUserId, members, t }: { reply: DocumentCommentData; currentUserId: string; members: { id: string; name: string; avatar?: string | null }[]; t: any }) {
  const { editComment, removeComment } = useDocumentCommentStore();
  const [editing, setEditing] = useState(false);
  const [hovered, setHovered] = useState(false);
  const isOwn = reply.createdBy === currentUserId;

  return (
    <div
      style={{ display: 'flex', gap: '8px' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ flexShrink: 0, marginTop: '1px' }}>
        <Avatar name={reply.user.name} avatar={reply.user.avatar} size={20} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
          <span style={{ fontSize: '11.5px', fontWeight: 600, color: C.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '90px' }}>
            {reply.user.name}
          </span>
          <RelativeTime iso={reply.createdAt} />
          {isOwn && !editing && hovered && (
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '2px', flexShrink: 0 }}>
              <IconBtn onClick={() => setEditing(true)} title="Editar"><Pencil style={{ width: '11px', height: '11px' }} /></IconBtn>
              <IconBtn onClick={() => removeComment(reply.id, reply.documentId)} title="Eliminar" danger><Trash2 style={{ width: '11px', height: '11px' }} /></IconBtn>
            </div>
          )}
        </div>
        {editing ? (
          <CommentForm
            initialValue={reply.content} submitLabel={t.btn_save} autoFocus members={members}
            onSubmit={async (c) => { await editComment(reply.id, c); setEditing(false); }}
            onCancel={() => setEditing(false)} t={t}
          />
        ) : (
          <p style={{ fontSize: '12.5px', color: C.text2, lineHeight: 1.55, wordBreak: 'break-word' }}>
            <Mentions text={reply.content} />
          </p>
        )}
      </div>
    </div>
  );
}

// ─── CommentThread ────────────────────────────────────────────────────────────

function CommentThread({ comment, isActive, currentUserId, members, onFocus, documentId, t }: {
  comment: DocumentCommentData; isActive: boolean; currentUserId: string;
  members: { id: string; name: string; avatar?: string | null }[];
  onFocus: () => void; documentId: string; t: any;
}) {
  const { editComment, removeComment, resolveComment, addComment } = useDocumentCommentStore();
  const [editing,     setEditing]     = useState(false);
  const [replying,    setReplying]    = useState(false);
  const [showReplies, setShowReplies] = useState(true);
  const isOwn      = comment.createdBy === currentUserId;
  const replyCount = comment.replies?.length ?? 0;

  const borderColor = comment.resolved
    ? C.border
    : isActive
      ? `${C.accent}50`
      : C.border;

  const bg = comment.resolved
    ? `${C.surface}80`
    : isActive
      ? `${C.accent}08`
      : C.surface;

  return (
    <div
      onClick={(e) => { if (!(e.target as HTMLElement).closest('button, textarea')) onFocus(); }}
      style={{
        borderRadius: '9px', border: `1px solid ${borderColor}`,
        background: bg, overflow: 'hidden', cursor: 'default',
        opacity: comment.resolved ? 0.55 : 1,
        transition: 'border-color 0.2s, background 0.2s',
        boxShadow: isActive ? `0 0 0 1px ${C.accent}20` : 'none',
      }}
    >
      {/* Accent top bar */}
      {!comment.resolved && (
        <div style={{ height: '2px', background: isActive ? C.accent : 'transparent', transition: 'background 0.2s' }} />
      )}

      <div style={{ padding: '11px 12px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '9px' }}>
          <Avatar name={comment.user.name} avatar={comment.user.avatar} size={26} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '4px', marginBottom: '5px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                <span style={{ fontSize: '12.5px', fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {comment.user.name}
                </span>
                <RelativeTime iso={comment.createdAt} />
              </div>

              {/* Acciones */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
                {comment.resolved ? (
                  <>
                    <span style={{
                      display: 'flex', alignItems: 'center', gap: '3px',
                      fontSize: '10.5px', color: C.green, fontWeight: 500,
                      padding: '2px 7px', borderRadius: '100px',
                      background: `${C.green}15`, border: `1px solid ${C.green}30`,
                    }}>
                      <Check style={{ width: '10px', height: '10px' }} /> Resuelto
                    </span>
                    <IconBtn onClick={(e) => { e.stopPropagation(); resolveComment(comment.id, false); }} title="Reabrir">
                      <RotateCcw style={{ width: '11px', height: '11px' }} />
                    </IconBtn>
                  </>
                ) : (
                  <IconBtn onClick={(e) => { e.stopPropagation(); resolveComment(comment.id, true); }} title="Marcar resuelto" green>
                    <Check style={{ width: '12px', height: '12px' }} />
                  </IconBtn>
                )}
                {isOwn && (
                  <>
                    <IconBtn onClick={(e) => { e.stopPropagation(); setEditing(!editing); }} title="Editar">
                      <Pencil style={{ width: '11px', height: '11px' }} />
                    </IconBtn>
                    <IconBtn onClick={(e) => { e.stopPropagation(); removeComment(comment.id, documentId); }} title="Eliminar" danger>
                      <Trash2 style={{ width: '11px', height: '11px' }} />
                    </IconBtn>
                  </>
                )}
              </div>
            </div>

            {/* Contenido */}
            {editing ? (
              <CommentForm
                initialValue={comment.content} submitLabel={t.btn_save} autoFocus members={members}
                onSubmit={async (c) => { await editComment(comment.id, c); setEditing(false); }}
                onCancel={() => setEditing(false)} t={t}
              />
            ) : (
              <p style={{ fontSize: '12.5px', color: C.text2, lineHeight: 1.6, wordBreak: 'break-word' }}>
                <Mentions text={comment.content} />
              </p>
            )}
          </div>
        </div>

        {/* Pie: replies */}
        {!comment.resolved && (
          <div style={{ marginTop: '10px', paddingLeft: '35px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {replyCount > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); setShowReplies((v) => !v); }}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', color: C.text4, padding: 0 }}
              >
                {showReplies
                  ? <ChevronDown style={{ width: '11px', height: '11px' }} />
                  : <ChevronRight style={{ width: '11px', height: '11px' }} />
                }
                {replyCount} {replyCount === 1 ? 'respuesta' : 'respuestas'}
              </button>
            )}

            {showReplies && replyCount > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '6px', borderTop: `1px solid ${C.border}` }}>
                {comment.replies!.map((reply: DocumentCommentData) => (
                  <ReplyItem key={reply.id} reply={reply} currentUserId={currentUserId} members={members} t={t} />
                ))}
              </div>
            )}

            {replying ? (
              <CommentForm
                placeholder={t.editor_comment_reply_placeholder} submitLabel={t.editor_comment_btn_reply}
                autoFocus members={members}
                onSubmit={async (c, mentions) => { await addComment(documentId, c, comment.position, comment.id, mentions); setReplying(false); }}
                onCancel={() => setReplying(false)} t={t}
              />
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); setReplying(true); }}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '11.5px', color: C.text4, padding: 0 }}
              >
                <Reply style={{ width: '11px', height: '11px' }} /> Responder
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── NewCommentPanel ──────────────────────────────────────────────────────────

function NewCommentPanel({ documentId, position, selectedText, onDone, members, t }: {
  documentId: string; position: { from: number; to: number }; selectedText: string;
  onDone: () => void; members: { id: string; name: string; avatar?: string | null }[]; t: any;
}) {
  const { addComment }  = useDocumentCommentStore();
  const currentUser = useAuthStore((s) => s.user);

  return (
    <div style={{
      borderRadius: '9px', border: `1px solid ${C.accent}35`,
      background: `${C.accent}08`, padding: '12px',
      display: 'flex', flexDirection: 'column', gap: '10px',
    }}>
      {selectedText.trim() && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
          <div style={{ width: '2px', alignSelf: 'stretch', borderRadius: '2px', background: C.accent, flexShrink: 0 }} />
          <p style={{ fontSize: '11.5px', color: C.text3, fontStyle: 'italic', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {selectedText}
          </p>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
        {currentUser && <div style={{ flexShrink: 0, marginTop: '2px' }}><Avatar name={currentUser.name} avatar={currentUser.avatar} size={24} /></div>}
        <div style={{ flex: 1, minWidth: 0 }}>
          <CommentForm
            placeholder={t.editor_comment_new_placeholder} autoFocus members={members}
            onSubmit={async (content, mentions) => { await addComment(documentId, content, position, null, mentions); onDone(); }}
            onCancel={onDone} t={t}
          />
        </div>
      </div>
    </div>
  );
}

// ─── CommentGutterIndicators ──────────────────────────────────────────────────

export interface CommentGutterIndicatorsProps {
  comments: DocumentCommentData[];
  activeCommentId: string | null;
  editorEl: HTMLElement | null;
  scrollEl: HTMLElement | null;
  onIndicatorClick: (commentId: string) => void;
}

export function CommentGutterIndicators({ comments, activeCommentId, editorEl, scrollEl, onIndicatorClick }: CommentGutterIndicatorsProps) {
  const [positions, setPositions] = useState<{ id: string; y: number; comment: DocumentCommentData }[]>([]);

  useEffect(() => {
    if (!editorEl || !scrollEl) return;
    const calculate = () => {
      const editorRect = editorEl.getBoundingClientRect();
      const next: typeof positions = [];
      comments.filter((c) => !c.resolved && !c.parentId).forEach((comment) => {
        const span = editorEl.querySelector(`[data-comment-id="${comment.id}"]`) as HTMLElement | null;
        if (!span) return;
        next.push({ id: comment.id, y: span.getBoundingClientRect().top - editorRect.top, comment });
      });
      next.sort((a, b) => a.y - b.y);
      const STACK_GAP = 28;
      for (let i = 1; i < next.length; i++) {
        if (next[i].y - next[i - 1].y < STACK_GAP) next[i].y = next[i - 1].y + STACK_GAP;
      }
      setPositions(next);
    };
    calculate();
    const ro = new ResizeObserver(calculate);
    ro.observe(editorEl);
    scrollEl.addEventListener('scroll', calculate, { passive: true });
    return () => { ro.disconnect(); scrollEl.removeEventListener('scroll', calculate); };
  }, [comments, editorEl, scrollEl]);

  if (positions.length === 0) return null;

  return (
    <>
      {positions.map(({ id, y, comment }) => {
        const isActive   = activeCommentId === id;
        const replyCount = comment.replies?.length ?? 0;
        return (
          <button
            key={id}
            onClick={() => onIndicatorClick(id)}
            title={`${comment.user.name}: ${comment.content.slice(0, 60)}`}
            style={{
              position: 'absolute', top: y - 12, right: 0,
              display: 'flex', alignItems: 'center', gap: '4px',
              transform: isActive ? 'scale(1.05)' : 'scale(1)',
              zIndex: isActive ? 20 : 10,
              transition: 'transform 0.15s',
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            }}
          >
            <div style={{ height: '1px', width: '10px', background: isActive ? `${C.accent}70` : `${C.border2}` }} />
            <div style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              padding: '2px 6px 2px 2px', borderRadius: '100px',
              background: isActive ? `${C.accent}18` : C.surface,
              border: `1px solid ${isActive ? `${C.accent}50` : C.border2}`,
              transition: 'all 0.15s',
            }}>
              <Avatar name={comment.user.name} avatar={comment.user.avatar} size={18} />
              {replyCount > 0 && (
                <span style={{ fontSize: '10px', fontWeight: 600, color: isActive ? C.accent : C.text4 }}>{replyCount}</span>
              )}
            </div>
          </button>
        );
      })}
    </>
  );
}

// ─── Sidebar principal ────────────────────────────────────────────────────────

export interface DocumentCommentsSidebarProps {
  documentId: string;
  canEdit: boolean;
  members?: { id: string; name: string; avatar?: string | null }[];
  onCommentFocus?: (commentId: string, position: { from: number; to: number }) => void;
  selectedText?: string;
}

export function DocumentCommentsSidebar({ documentId, canEdit, members = [], onCommentFocus, selectedText = '' }: DocumentCommentsSidebarProps) {
  const t = useT();
  const { fetchComments, setActiveComment, setSidebarOpen, setPendingSelection } = useDocumentCommentStore();
  const comments        = useDocumentCommentStore(selectDocumentComments(documentId));
  const activeCommentId = useDocumentCommentStore(selectActiveCommentId);
  const sidebarOpen     = useDocumentCommentStore(selectSidebarOpen);
  const pendingSelection= useDocumentCommentStore(selectPendingSelection);
  const currentUser     = useAuthStore((s) => s.user);

  const [showResolved, setShowResolved] = useState(false);
  const activeRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetchComments(documentId); }, [documentId, fetchComments]);
  useEffect(() => { if (activeCommentId && activeRef.current) activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [activeCommentId]);

  const openComments    = comments.filter((c) => !c.resolved);
  const resolvedComments= comments.filter((c) => c.resolved);
  const visibleComments = showResolved ? comments : openComments;

  if (!sidebarOpen) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', background: C.surface }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 14px', borderBottom: `1px solid ${C.border}`, flexShrink: 0,
        background: C.bg2,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <MessageSquare style={{ width: '13px', height: '13px', color: C.accent, flexShrink: 0 }} />
          <span style={{ fontSize: '13px', fontWeight: 600, color: C.text }}>Comentarios</span>
          {openComments.length > 0 && (
            <span style={{
              fontSize: '10.5px', fontWeight: 700, padding: '1px 6px', borderRadius: '100px',
              background: `${C.accent}18`, color: C.accent, border: `1px solid ${C.accent}30`,
              flexShrink: 0, lineHeight: '18px',
            }}>
              {openComments.length}
            </span>
          )}
        </div>
        <CloseBtn onClick={() => setSidebarOpen(false)} />
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>

        {/* Nuevo comentario */}
        {pendingSelection && canEdit && (
          <NewCommentPanel
            documentId={documentId} position={pendingSelection}
            selectedText={selectedText} members={members}
            onDone={() => setPendingSelection(null)} t={t}
          />
        )}

        {/* Empty */}
        {visibleComments.length === 0 && !pendingSelection && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 16px', textAlign: 'center', gap: '10px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '9px',
              background: C.hover, border: `1px solid ${C.border2}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <MessageSquare style={{ width: '16px', height: '16px', color: C.text4 }} />
            </div>
            <p style={{ fontSize: '12px', color: C.text4, lineHeight: 1.6 }}>
              {canEdit ? 'Selecciona texto en el documento\npara añadir un comentario' : 'Sin comentarios aún'}
            </p>
          </div>
        )}

        {/* Threads */}
        {visibleComments.map((comment) => (
          <div key={comment.id} ref={activeCommentId === comment.id ? activeRef : undefined}>
            <CommentThread
              comment={comment} isActive={activeCommentId === comment.id}
              currentUserId={currentUser?.id ?? ''} members={members}
              documentId={documentId}
              onFocus={() => { setActiveComment(comment.id); onCommentFocus?.(comment.id, comment.position); }}
              t={t}
            />
          </div>
        ))}

        {/* Toggle resueltos */}
        {resolvedComments.length > 0 && (
          <button
            onClick={() => setShowResolved((v) => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              width: '100%', padding: '8px 0', fontSize: '11.5px', color: C.text4,
              background: 'none', border: 'none', borderTop: `1px solid ${C.border}`,
              cursor: 'pointer', marginTop: '4px',
            }}
          >
            {showResolved
              ? <ChevronDown style={{ width: '12px', height: '12px' }} />
              : <ChevronRight style={{ width: '12px', height: '12px' }} />
            }
            {resolvedComments.length} resuelto{resolvedComments.length !== 1 ? 's' : ''}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

function IconBtn({ onClick, title, children, danger, green }: {
  onClick: (e: React.MouseEvent) => void; title: string; children: React.ReactNode;
  danger?: boolean; green?: boolean;
}) {
  const [h, setH] = useState(false);
  const hoverColor = danger ? C.red : green ? C.green : C.text2;
  return (
    <button
      onClick={onClick} title={title}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        width: '22px', height: '22px', borderRadius: '5px', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        background: h ? (danger ? `${C.red}15` : green ? `${C.green}15` : C.hover) : 'transparent',
        border: 'none', color: h ? hoverColor : C.text4, cursor: 'pointer', transition: 'all 0.1s',
      }}
    >
      {children}
    </button>
  );
}

function CloseBtn({ onClick }: { onClick: () => void }) {
  const [h, setH] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        width: '24px', height: '24px', borderRadius: '6px', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        background: h ? C.hover : 'transparent', border: 'none',
        color: h ? C.text2 : C.text4, cursor: 'pointer',
      }}
    >
      <X style={{ width: '13px', height: '13px' }} />
    </button>
  );
}
