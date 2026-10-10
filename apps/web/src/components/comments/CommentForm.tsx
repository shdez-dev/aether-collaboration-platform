// apps/web/src/components/comments/CommentForm.tsx
'use client';

import { useState, useRef, KeyboardEvent, useEffect } from 'react';
import { FileText, Send, X } from 'lucide-react';
import { DocumentReferencePicker, type SelectedDocumentReference } from './DocumentReferencePicker';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceMembers } from '@/hooks/useWorkspaceMembers';
import { es } from '@/lib/i18n';
import { C } from '@/lib/colors';

interface CommentFormProps {
  onSubmit: (content: string, mentions?: string[], documentReference?: Pick<SelectedDocumentReference, 'documentId' | 'from' | 'to' | 'quote'>) => Promise<void>;
  cardId?: string;
  submitText?: string;
  placeholder?: string;
  initialValue?: string;
  isEditing?: boolean;
  onCancel?: () => void;
  isLoading?: boolean;
  autoFocus?: boolean;
  workspaceId?: string;
  mentionCandidates?: MentionCandidate[];
  initialMentions?: string[];
}

export type MentionCandidate = { id: string; name: string; email: string; avatar?: string | null };

const AVATAR_PALETTE = ['#3b82f6','#10b981','#f59e0b','#a855f7','#ec4899','#06b6d4','#fb923c'];
function hashColor(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}
function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

export function CommentForm({
  onSubmit, submitText, placeholder, initialValue = '',
  isEditing = false, onCancel, isLoading = false, autoFocus = false, workspaceId, cardId,
  mentionCandidates, initialMentions = [],
}: CommentFormProps) {
  const t = es;
  const resolvedSubmitText = submitText ?? t.comments_default_submit;
  const resolvedPlaceholder = placeholder ?? t.comments_default_placeholder;

  const [content, setContent]       = useState(initialValue);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState(0);
  const [activeIndex, setActiveIndex]   = useState(0);
  const [submitError, setSubmitError] = useState('');
  const [referencePickerOpen, setReferencePickerOpen] = useState(false);
  const [documentReference, setDocumentReference] = useState<SelectedDocumentReference | null>(null);
  const mentionIdsRef = useRef<Map<string, string>>(new Map());
  const textareaRef   = useRef<HTMLTextAreaElement>(null);
  const { user }      = useAuthStore();
  const { members: workspaceMembers } = useWorkspaceMembers(mentionCandidates ? undefined : workspaceId);
  const members = mentionCandidates ?? workspaceMembers;

  useEffect(() => {
    if (!isEditing) return;
    for (const id of initialMentions) {
      const member = members.find((person) => person.id === id);
      if (member && initialValue.includes(`@[${member.name}]`)) mentionIdsRef.current.set(id, member.name);
    }
  }, [isEditing, initialMentions, initialValue, members]);

  useEffect(() => { setActiveIndex(0); }, [mentionQuery]);

  // Auto-resize
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [content]);

  const filtered = mentionQuery !== null
    ? members.filter((m) =>
        m.name.toLowerCase().includes(mentionQuery.toLowerCase()) ||
        m.email.toLowerCase().includes(mentionQuery.toLowerCase())
      ).slice(0, 6)
    : [];

  const insertMention = (member: MentionCandidate) => {
    const el = textareaRef.current;
    const cursorPos = el ? (el.selectionStart ?? mentionStart) : mentionStart;
    const before = content.slice(0, mentionStart);
    const after  = content.slice(cursorPos);
    const mention = `@[${member.name}] `;
    if (before.length + mention.length + after.length > 2000) {
      setSubmitError('El comentario no puede superar 2000 caracteres.');
      return;
    }
    mentionIdsRef.current.set(member.id, member.name);
    setContent(before + mention + after);
    setMentionQuery(null);
    setTimeout(() => {
      if (el) { const p = (before + mention).length; el.focus(); el.setSelectionRange(p, p); }
    }, 0);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    setContent(v);
    setSubmitError('');
    const cursor = e.target.selectionStart ?? 0;
    const before = v.slice(0, cursor);
    const at = before.lastIndexOf('@');
    const query = at >= 0 ? before.slice(at + 1) : '';
    if (at >= 0 && (at === 0 || /\s/.test(before[at - 1])) && !/[\]\n]/.test(query) && query.length <= 40) {
      setMentionQuery(query);
      setMentionStart(at);
    } else setMentionQuery(null);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery !== null && filtered.length > 0) {
      if (e.key === 'ArrowDown')  { e.preventDefault(); setActiveIndex((i) => (i + 1) % filtered.length); return; }
      if (e.key === 'ArrowUp')    { e.preventDefault(); setActiveIndex((i) => (i - 1 + filtered.length) % filtered.length); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insertMention(filtered[activeIndex]); return; }
      if (e.key === 'Escape')     { e.preventDefault(); setMentionQuery(null); return; }
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); handleSubmit(); return; }
    if (e.key === 'Escape' && isEditing && onCancel)    { e.preventDefault(); onCancel(); }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!content.trim() || isSubmitting || isLoading) return;
    if (content.length > 2000) { setSubmitError('El comentario no puede superar 2000 caracteres.'); return; }
    setIsSubmitting(true);
    const mentionIds = Array.from(mentionIdsRef.current.entries())
      .filter(([, name]) => content.includes(`@[${name}]`))
      .map(([id]) => id);
    try {
      setSubmitError('');
      if (documentReference) {
        await onSubmit(content, mentionIds, {
          documentId: documentReference.documentId,
          from: documentReference.from,
          to: documentReference.to,
          quote: documentReference.quote,
        });
      } else {
        await onSubmit(content, mentionIds);
      }
      if (!isEditing) {
        setContent('');
        setMentionQuery(null);
        mentionIdsRef.current = new Map();
        setDocumentReference(null);
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'No se pudo publicar el comentario');
    } finally { setIsSubmitting(false); }
  };

  const loading = isSubmitting || isLoading;
  const isEmpty = !content.trim();

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
        {/* User avatar */}
        {!isEditing && user && (
          <div style={{
            width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
            background: hashColor(user.name),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '10px', fontWeight: 700, color: '#fff',
          }}>
            {initials(user.name)}
          </div>
        )}

        {/* Textarea + mention dropdown */}
        <div style={{ flex: 1, position: 'relative' }}>
          <div style={{ borderRadius: '10px', border: `1px solid ${C.border}`, background: C.bg2, transition: 'border-color 0.12s' }}
            onFocusCapture={(e) => (e.currentTarget.style.borderColor = C.accent)}
            onBlurCapture={(e) => (e.currentTarget.style.borderColor = C.border)}
          >
            <textarea
              ref={textareaRef}
              value={content}
              maxLength={2000}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder={resolvedPlaceholder}
              disabled={loading}
              autoFocus={autoFocus}
              rows={3}
              style={{
                width: '100%', background: 'transparent', border: 'none', outline: 'none',
                resize: 'none', padding: '12px 14px', fontSize: '13px',
                color: C.text, lineHeight: 1.6,
                maxHeight: '200px', boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ textAlign: 'right', fontSize: '10.5px', color: content.length > 2000 ? C.red : C.text4 }}>{content.length}/2000</div>

          {/* Mention dropdown */}
          {filtered.length > 0 && (
            <div
              onMouseDown={(e) => e.preventDefault()}
              style={{
                position: 'absolute', top: '100%', left: 0, marginTop: '6px',
                width: '240px', background: C.surface, border: `1px solid ${C.border2}`,
                borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                zIndex: 9999, overflow: 'hidden', padding: '4px 0',
              }}
            >
              <p style={{ padding: '4px 12px', fontSize: '10px', color: C.text4, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
                {t.comments_mention_header}
              </p>
              {filtered.map((m, idx) => (
                <button
                  key={m.id} type="button"
                  onMouseDown={(e) => { e.preventDefault(); insertMention(m); }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '7px 12px', background: idx === activeIndex ? `${C.accent}18` : 'transparent',
                    border: 'none', cursor: 'pointer', textAlign: 'left',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = C.hover)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = idx === activeIndex ? `${C.accent}18` : 'transparent')}
                >
                  <div style={{
                    width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0,
                    background: hashColor(m.name),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '9px', fontWeight: 700, color: '#fff',
                  }}>
                    {initials(m.name)}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: 500, color: idx === activeIndex ? C.accent : C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</div>
                    <div style={{ fontSize: '10.5px', color: C.text4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.email}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
          {mentionQuery !== null && filtered.length === 0 && (
            <div role="status" style={{ position: 'absolute', top: '100%', left: 0, marginTop: 6, padding: '9px 12px', borderRadius: 8, background: C.surface, border: `1px solid ${C.border}`, color: C.text3, fontSize: 11.5, zIndex: 9999 }}>
              No hay personas que coincidan.
            </div>
          )}

          {/* Hint */}
          <p style={{ marginTop: '4px', fontSize: '10.5px', color: C.text4, lineHeight: 1.5 }}>
            <button type="button" onClick={() => {
              const el = textareaRef.current;
              const cursor = el?.selectionStart ?? content.length;
              const next = `${content.slice(0, cursor)}@${content.slice(cursor)}`;
              if (next.length > 2000) return;
              setContent(next); setMentionStart(cursor); setMentionQuery('');
              setTimeout(() => { el?.focus(); el?.setSelectionRange(cursor + 1, cursor + 1); }, 0);
            }} style={{ padding: '1px 5px', borderRadius: 4, border: `1px solid ${C.border2}`, background: C.hover, color: C.text2, cursor: 'pointer', fontSize: 11 }}>@ Mencionar</button>{' '}
            {t.comments_hint_mention}
            {' | '}
            <kbd style={{ borderRadius: '3px', border: `1px solid ${C.border2}`, background: C.hover, padding: '0 4px', fontSize: '10px' }}>Ctrl</kbd>
            {'+'}
            <kbd style={{ borderRadius: '3px', border: `1px solid ${C.border2}`, background: C.hover, padding: '0 4px', fontSize: '10px' }}>Enter</kbd>{' '}
            {t.comments_hint_send}
            {isEditing && (
              <>{' | '}<kbd style={{ borderRadius: '3px', border: `1px solid ${C.border2}`, background: C.hover, padding: '0 4px', fontSize: '10px' }}>Esc</kbd>{' '}{t.comments_hint_cancel}</>
            )}
          </p>
          {!isEditing && cardId && (
            <div style={{ marginTop: 8 }}>
              {documentReference ? (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px', border: `1px solid ${C.border2}`, borderRadius: 8, background: C.surface }}>
                  <FileText size={14} style={{ color: C.accent, flexShrink: 0 }} />
                  <div style={{ minWidth: 0, flex: 1, fontSize: 11, color: C.text2 }}>
                    <strong style={{ display: 'block', color: C.text }}>{documentReference.title}</strong>
                    <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>“{documentReference.quote}”</span>
                  </div>
                  <button type="button" onClick={() => setDocumentReference(null)} aria-label="Quitar referencia" style={{ border: 0, background: 'transparent', color: C.text3, cursor: 'pointer' }}><X size={13} /></button>
                </div>
              ) : <button type="button" onClick={() => setReferencePickerOpen(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: `1px solid ${C.border}`, borderRadius: 6, padding: '5px 8px', background: C.surface, color: C.text2, cursor: 'pointer', fontSize: 11 }}><FileText size={12} /> Referenciar documento</button>}
              {referencePickerOpen && <div style={{ marginTop: 8 }}><DocumentReferencePicker cardId={cardId} onClose={() => setReferencePickerOpen(false)} onSelect={(reference) => { setDocumentReference(reference); setReferencePickerOpen(false); }} /></div>}
            </div>
          )}
          {submitError && <p role="alert" style={{ margin: '4px 0 0', fontSize: 11.5, color: C.red }}>{submitError}</p>}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
        {isEditing && onCancel && (
          <button
            type="button" onClick={() => { setContent(initialValue); setMentionQuery(null); onCancel?.(); }}
            disabled={loading}
            style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 500, background: C.hover, border: `1px solid ${C.border2}`, color: C.text2, cursor: 'pointer' }}
          >
            {t.btn_cancel}
          </button>
        )}
        <button
          type="submit" disabled={isEmpty || loading || content.length > 2000}
          style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            padding: '9px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
            background: isEmpty || loading || content.length > 2000 ? C.border2 : C.accent,
            color: isEmpty || loading || content.length > 2000 ? C.text4 : '#fff',
            border: 'none', cursor: isEmpty || loading || content.length > 2000 ? 'not-allowed' : 'pointer',
            transition: 'background 0.12s',
          }}
        >
          {loading
            ? <div style={{ width: '12px', height: '12px', borderRadius: '50%', border: '2px solid rgba(97,71,130,0.3)', borderTopColor: '#fff', animation: 'spin 0.6s linear infinite' }} />
            : <Send style={{ width: '11px', height: '11px' }} />
          }
          {resolvedSubmitText}
        </button>
      </div>
    </form>
  );
}
