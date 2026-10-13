// apps/web/src/components/comments/CommentForm.tsx
'use client';

import { useState, useRef, KeyboardEvent, useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { FileText, Send, X } from 'lucide-react';
import { DocumentReferencePicker, type SelectedDocumentReference } from './DocumentReferencePicker';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceMembers } from '@/hooks/useWorkspaceMembers';
import { es } from '@/lib/i18n';
import { C } from '@/lib/colors';
import { CommentAvatar } from './CommentAvatar';
import styles from './CommentForm.module.css';

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

function caretCoordinates(textarea: HTMLTextAreaElement, position: number) {
  const mirror = document.createElement('div');
  const computed = getComputedStyle(textarea);
  const rect = textarea.getBoundingClientRect();
  const properties = [
    'font-family', 'font-size', 'font-weight', 'font-style', 'letter-spacing',
    'line-height', 'text-transform', 'text-indent', 'text-align', 'tab-size',
    'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
    'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
    'box-sizing', 'word-break', 'overflow-wrap',
  ];
  for (const property of properties) mirror.style.setProperty(property, computed.getPropertyValue(property));
  Object.assign(mirror.style, {
    position: 'fixed', left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`,
    whiteSpace: 'pre-wrap', visibility: 'hidden', pointerEvents: 'none', overflow: 'hidden',
  });
  mirror.append(document.createTextNode(textarea.value.slice(0, position)));
  const marker = document.createElement('span');
  marker.textContent = '\u200b';
  mirror.append(marker);
  document.body.append(mirror);
  const markerRect = marker.getBoundingClientRect();
  mirror.remove();
  return { left: markerRect.left - textarea.scrollLeft, top: markerRect.top - textarea.scrollTop, bottom: markerRect.bottom - textarea.scrollTop };
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
  const [caretIndex, setCaretIndex] = useState(0);
  const [activeIndex, setActiveIndex]   = useState(0);
  const [popupPosition, setPopupPosition] = useState<{ top: number; left: number } | null>(null);
  const [submitError, setSubmitError] = useState('');
  const [referencePickerOpen, setReferencePickerOpen] = useState(false);
  const [documentReference, setDocumentReference] = useState<SelectedDocumentReference | null>(null);
  const mentionIdsRef = useRef<Map<string, string>>(new Map());
  const textareaRef   = useRef<HTMLTextAreaElement>(null);
  const mentionListId = useId();
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

  useEffect(() => { setActiveIndex(0); }, [mentionQuery, members]);

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

  useEffect(() => {
    if (mentionQuery === null) { setPopupPosition(null); return; }
    const updatePosition = () => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const caret = caretCoordinates(textarea, caretIndex);
      const width = 280;
      const height = filtered.length ? Math.min(filtered.length * 48 + 12, 312) : 54;
      const below = window.innerHeight - caret.bottom;
      const top = below < height + 12 && caret.top > height
        ? caret.top - height - 8
        : caret.bottom + 8;
      setPopupPosition({
        top: Math.max(8, Math.min(top, window.innerHeight - height - 8)),
        left: Math.max(8, Math.min(caret.left, window.innerWidth - width - 8)),
      });
    };
    const frame = requestAnimationFrame(updatePosition);
    document.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [mentionQuery, caretIndex, content, filtered.length]);

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

  const syncMentionAtCursor = (value: string, cursor: number) => {
    setCaretIndex(cursor);
    const before = value.slice(0, cursor);
    const at = before.lastIndexOf('@');
    const query = at >= 0 ? before.slice(at + 1) : '';
    if (at >= 0 && (at === 0 || /\s/.test(before[at - 1])) && !/[\]\n]/.test(query) && query.length <= 40) {
      setMentionQuery(query);
      setMentionStart(at);
    } else setMentionQuery(null);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    setContent(v);
    setSubmitError('');
    syncMentionAtCursor(v, e.target.selectionStart ?? 0);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); handleSubmit(); return; }
    if (mentionQuery !== null && filtered.length > 0) {
      if (e.key === 'ArrowDown')  { e.preventDefault(); setActiveIndex((i) => (i + 1) % filtered.length); return; }
      if (e.key === 'ArrowUp')    { e.preventDefault(); setActiveIndex((i) => (i - 1 + filtered.length) % filtered.length); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insertMention(filtered[Math.min(activeIndex, filtered.length - 1)]); return; }
    }
    if (e.key === 'Escape' && mentionQuery !== null) { e.preventDefault(); e.stopPropagation(); setMentionQuery(null); return; }
    if (e.key === 'Escape' && isEditing && onCancel) { e.preventDefault(); e.stopPropagation(); onCancel(); }
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
    <>
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
        {/* User avatar */}
        {!isEditing && user && (
          <CommentAvatar name={user.name} avatar={user.avatar} size={28} />
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
              onSelect={(e) => syncMentionAtCursor(e.currentTarget.value, e.currentTarget.selectionStart ?? 0)}
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={mentionQuery !== null && filtered.length > 0}
              aria-controls={mentionQuery !== null && filtered.length > 0 ? mentionListId : undefined}
              aria-activedescendant={mentionQuery !== null && filtered.length > 0 ? `${mentionListId}-${filtered[Math.min(activeIndex, filtered.length - 1)].id}` : undefined}
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

          <p className={styles.hint}>Escribe <kbd>@</kbd> para mencionar a alguien <span aria-hidden="true">—</span> <kbd>Ctrl</kbd> + <kbd>Enter</kbd> para enviar</p>
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
    {mentionQuery !== null && popupPosition && typeof document !== 'undefined' && createPortal(
      <div
        id={filtered.length > 0 ? mentionListId : undefined}
        role={filtered.length > 0 ? 'listbox' : 'status'}
        aria-label={filtered.length > 0 ? 'Personas del proyecto' : undefined}
        className={styles.mentionMenu}
        style={{ top: popupPosition.top, left: popupPosition.left }}
        onMouseDown={(event) => event.preventDefault()}
      >
        {filtered.length > 0 ? filtered.map((member, index) => (
          <button
            id={`${mentionListId}-${member.id}`}
            key={member.id}
            type="button"
            role="option"
            aria-selected={index === activeIndex}
            className={styles.mentionOption}
            onMouseEnter={() => setActiveIndex(index)}
            onMouseDown={(event) => { event.preventDefault(); insertMention(member); }}
          >
            <CommentAvatar name={member.name} avatar={member.avatar} size={28} />
            <span className={styles.mentionIdentity}>
              <strong>{member.name}</strong>
              <small>{member.email}</small>
            </span>
          </button>
        )) : <span className={styles.mentionEmpty}>No hay personas que coincidan</span>}
      </div>,
      document.body,
    )}
    </>
  );
}
