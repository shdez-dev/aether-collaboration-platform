// apps/web/src/components/comments/CommentForm.tsx

'use client';

import { useState, useRef, KeyboardEvent, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Send } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceMembers } from '@/hooks/useWorkspaceMembers';
import { getAvatarUrl } from '@/lib/utils/avatar';
import { useT } from '@/lib/i18n';

interface CommentFormProps {
  onSubmit: (content: string, mentions?: string[]) => Promise<void>;
  submitText?: string;
  placeholder?: string;
  initialValue?: string;
  isEditing?: boolean;
  onCancel?: () => void;
  isLoading?: boolean;
  autoFocus?: boolean;
  workspaceId?: string;
}

export function CommentForm({
  onSubmit,
  submitText,
  placeholder,
  initialValue = '',
  isEditing = false,
  onCancel,
  isLoading = false,
  autoFocus = false,
  workspaceId,
}: CommentFormProps) {
  const t = useT();
  const resolvedSubmitText = submitText ?? t.comments_default_submit;
  const resolvedPlaceholder = placeholder ?? t.comments_default_placeholder;

  const [content, setContent] = useState(initialValue);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Mention state ──────────────────────────────────────────────────────────
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { user } = useAuthStore();
  const { members } = useWorkspaceMembers(workspaceId);

  // Reset active index when query changes
  useEffect(() => {
    setActiveIndex(0);
  }, [mentionQuery]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [content]);

  // ── Filtered members list ──────────────────────────────────────────────────
  const filtered =
    mentionQuery !== null
      ? members
          .filter(
            (m) =>
              m.name.toLowerCase().includes(mentionQuery.toLowerCase()) ||
              m.email.toLowerCase().includes(mentionQuery.toLowerCase())
          )
          .slice(0, 6)
      : [];

  // ── Extract mention user IDs for the API ──────────────────────────────────
  // Supports both @[Nombre Completo] and legacy @PalabraSimple formats
  const extractMentionIds = (text: string): string[] => {
    const ids = new Set<string>();

    // Format @[Nombre Completo]
    const bracketRegex = /@\[([^\]]+)\]/g;
    let m: RegExpExecArray | null;
    while ((m = bracketRegex.exec(text)) !== null) {
      const name = m[1];
      const member = members.find((mb) => mb.name === name);
      if (member) ids.add(member.id);
    }

    // Legacy format @PalabraSimple
    const simpleRegex = /@(\w+)/g;
    while ((m = simpleRegex.exec(text)) !== null) {
      const username = m[1];
      const member = members.find(
        (mb) => mb.name.replace(/\s+/g, '').toLowerCase() === username.toLowerCase()
      );
      if (member) ids.add(member.id);
    }

    return Array.from(ids);
  };

  // ── Insert mention ─────────────────────────────────────────────────────────
  const insertMention = (name: string) => {
    const el = textareaRef.current;
    const cursorPos = el ? (el.selectionStart ?? mentionStart) : mentionStart;
    const before = content.slice(0, mentionStart);
    const after = content.slice(cursorPos);
    const mention = `@[${name}] `;
    const newValue = before + mention + after;
    setContent(newValue);
    setMentionQuery(null);
    setTimeout(() => {
      if (el) {
        const p = (before + mention).length;
        el.focus();
        el.setSelectionRange(p, p);
      }
    }, 0);
  };

  // ── Handle textarea change ─────────────────────────────────────────────────
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    setContent(v);
    const cursor = e.target.selectionStart ?? 0;
    const match = v.slice(0, cursor).match(/@([^@]*)$/);
    if (match) {
      setMentionQuery(match[1]);
      setMentionStart(cursor - match[0].length);
    } else {
      setMentionQuery(null);
    }
  };

  // ── Handle keyboard navigation ─────────────────────────────────────────────
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Dropdown navigation
    if (mentionQuery !== null && filtered.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % filtered.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + filtered.length) % filtered.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(filtered[activeIndex].name);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMentionQuery(null);
        return;
      }
    }

    // Submit
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
      return;
    }

    // Cancel edit
    if (e.key === 'Escape' && isEditing && onCancel) {
      e.preventDefault();
      onCancel();
    }
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!content.trim() || isSubmitting || isLoading) return;

    setIsSubmitting(true);
    try {
      const mentionIds = extractMentionIds(content);
      await onSubmit(content, mentionIds.length > 0 ? mentionIds : undefined);
      if (!isEditing) {
        setContent('');
        setMentionQuery(null);
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Cancel ─────────────────────────────────────────────────────────────────
  const handleCancel = () => {
    setContent(initialValue);
    setMentionQuery(null);
    onCancel?.();
  };

  const loading = isSubmitting || isLoading;
  const isEmpty = !content.trim();

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-3">
        {!isEditing && user && (
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarImage
              src={getAvatarUrl(user.avatar) || undefined}
              alt={user.name}
              crossOrigin="anonymous"
            />
            <AvatarFallback className="text-xs">
              {user.name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2)}
            </AvatarFallback>
          </Avatar>
        )}

        {/* Textarea + dropdown wrapper */}
        <div className="flex-1 relative">
          <div className="relative rounded-md border border-input bg-background">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder={resolvedPlaceholder}
              disabled={loading}
              autoFocus={autoFocus}
              rows={3}
              className="w-full resize-none bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none min-h-[80px]"
              style={{ maxHeight: 200 }}
            />
          </div>

          {/* Mention dropdown — positioned below the textarea */}
          {filtered.length > 0 && (
            <div
              className="absolute top-full left-0 mt-1.5 w-64 bg-popover border border-border rounded-lg shadow-2xl z-[9999] overflow-hidden py-1"
              // Prevent click from stealing focus
              onMouseDown={(e) => e.preventDefault()}
            >
              <p className="px-3 pt-1.5 pb-1 text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                {t.comments_mention_header}
              </p>
              {filtered.map((m, idx) => (
                <button
                  key={m.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    insertMention(m.name);
                  }}
                  className={`flex items-center gap-2.5 w-full px-3 py-2 text-sm transition-colors ${
                    idx === activeIndex
                      ? 'bg-accent/15 text-accent'
                      : 'text-popover-foreground hover:bg-muted'
                  }`}
                >
                  <Avatar className="h-6 w-6 shrink-0">
                    <AvatarImage
                      src={getAvatarUrl(m.avatar) || undefined}
                      alt={m.name}
                      crossOrigin="anonymous"
                    />
                    <AvatarFallback className="text-[10px]">
                      {m.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-start min-w-0">
                    <span className="font-medium leading-tight truncate">{m.name}</span>
                    <span className="text-[11px] text-muted-foreground truncate">{m.email}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          <p className="mt-1 text-xs text-muted-foreground">
            <kbd className="rounded border bg-muted px-1 text-[10px]">@</kbd>{' '}
            {t.comments_hint_mention}
            {' • '}
            <kbd className="rounded border bg-muted px-1 text-[10px]">Ctrl</kbd> +{' '}
            <kbd className="rounded border bg-muted px-1 text-[10px]">Enter</kbd>{' '}
            {t.comments_hint_send}
            {isEditing && (
              <>
                {' • '}
                <kbd className="rounded border bg-muted px-1 text-[10px]">Esc</kbd>{' '}
                {t.comments_hint_cancel}
              </>
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        {isEditing && onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={handleCancel} disabled={loading}>
            {t.btn_cancel}
          </Button>
        )}
        <Button type="submit" size="sm" disabled={isEmpty || loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {!loading && <Send className="mr-2 h-4 w-4" />}
          {resolvedSubmitText}
        </Button>
      </div>
    </form>
  );
}
