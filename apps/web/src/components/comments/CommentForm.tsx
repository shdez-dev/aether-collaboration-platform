// apps/web/src/components/comments/CommentForm.tsx

'use client';

import { useState, useRef, KeyboardEvent, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Send, AtSign } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceMembers, WorkspaceMember } from '@/hooks/useWorkspaceMembers';
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

  const [mentionMap, setMentionMap] = useState<Record<string, string>>({});

  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [selectedMemberIndex, setSelectedMemberIndex] = useState(0);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { user } = useAuthStore();

  const { members } = useWorkspaceMembers(workspaceId);

  const filteredMembers = members.filter(
    (member) =>
      member.name.toLowerCase().includes(mentionQuery.toLowerCase()) ||
      member.email.toLowerCase().includes(mentionQuery.toLowerCase())
  );

  /**
   * Renderizar texto con menciones destacadas
   * Texto normal: transparente
   * Menciones: azul (si existe en mentionMap O si el username coincide con un miembro)
   */
  const renderHighlightedText = () => {
    if (!content) return '';

    const mentionRegex = /@(\w+)/g;
    let lastIndex = 0;
    const parts: React.ReactNode[] = [];
    let match;

    while ((match = mentionRegex.exec(content)) !== null) {
      const mentionText = match[0]; // "@Sebastian"
      const username = match[1]; // "Sebastian"

      // Verificar si existe en el mapa O si coincide con algún miembro
      let isValidMention = false;

      if (mentionMap[mentionText]) {
        isValidMention = true;
      } else {
        // Buscar si existe un miembro con ese username
        const matchingMember = members.find(
          (m) => m.name.replace(/\s+/g, '').toLowerCase() === username.toLowerCase()
        );

        if (matchingMember) {
          isValidMention = true;
          // Agregar al mapa automáticamente
          setMentionMap((prev) => ({
            ...prev,
            [mentionText]: matchingMember.id,
          }));
        }
      }

      // Texto antes de la mención (transparente)
      if (match.index > lastIndex) {
        parts.push(
          <span key={`text-${lastIndex}`} className="text-transparent">
            {content.substring(lastIndex, match.index)}
          </span>
        );
      }

      // La mención (azul si es válida, transparente si no)
      parts.push(
        <span
          key={match.index}
          className={isValidMention ? 'text-blue-500 font-medium' : 'text-transparent'}
        >
          {mentionText}
        </span>
      );

      lastIndex = match.index + match[0].length;
    }

    // Texto después de la última mención (transparente)
    if (lastIndex < content.length) {
      parts.push(
        <span key={`text-${lastIndex}`} className="text-transparent">
          {content.substring(lastIndex)}
        </span>
      );
    }

    return parts;
  };

  /**
   * Sincronizar scroll entre textarea y highlight
   */
  const syncScroll = () => {
    if (textareaRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  /**
   * Extraer IDs de menciones
   */
  const extractMentionIds = (text: string): string[] => {
    const mentionRegex = /@(\w+)/g;
    const matches = text.matchAll(mentionRegex);
    const mentionIds = new Set<string>();

    for (const match of matches) {
      const mentionName = match[1];
      const userId = mentionMap[`@${mentionName}`];

      if (userId) {
        mentionIds.add(userId);
      }
    }

    return Array.from(mentionIds);
  };

  /**
   * Obtener nombres de usuarios mencionados
   */
  const getMentionedUserNames = (): string[] => {
    const mentionRegex = /@(\w+)/g;
    const matches = content.matchAll(mentionRegex);
    const names: string[] = [];

    for (const match of matches) {
      const mentionName = match[1];
      const userId = mentionMap[`@${mentionName}`];

      if (userId) {
        const member = members.find((m) => m.id === userId);
        if (member) {
          names.push(member.name);
        }
      }
    }

    return names;
  };

  /**
   * Ajustar altura del textarea
   */
  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;

    // Sincronizar altura del highlight
    if (highlightRef.current) {
      highlightRef.current.style.height = `${textarea.scrollHeight}px`;
    }
  };

  /**
   * Calcular posición del cursor en el textarea
   */
  const getCaretCoordinates = (element: HTMLTextAreaElement, position: number) => {
    const div = document.createElement('div');
    const style = getComputedStyle(element);

    // Copiar estilos del textarea
    for (const prop of style) {
      div.style.setProperty(prop, style.getPropertyValue(prop));
    }

    div.style.position = 'absolute';
    div.style.visibility = 'hidden';
    div.style.whiteSpace = 'pre-wrap';
    div.style.wordWrap = 'break-word';

    document.body.appendChild(div);

    const text = element.value.substring(0, position);
    div.textContent = text;

    const span = document.createElement('span');
    span.textContent = element.value.substring(position) || '.';
    div.appendChild(span);

    const rect = element.getBoundingClientRect();
    const spanRect = span.getBoundingClientRect();

    const coordinates = {
      top: spanRect.top - rect.top - element.scrollTop,
      left: spanRect.left - rect.left - element.scrollLeft,
    };

    document.body.removeChild(div);
    return coordinates;
  };

  /**
   * Actualizar posición del dropdown
   */
  const updateDropdownPosition = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const rect = textarea.getBoundingClientRect();
    const caretPos = getCaretCoordinates(textarea, textarea.selectionStart);

    setDropdownPosition({
      top: rect.top + caretPos.top + 20, // 20px debajo del cursor
      left: rect.left + caretPos.left,
    });
  };

  /**
   * Detectar trigger de mención
   */
  const detectMentionTrigger = (text: string, cursorPosition: number) => {
    const textBeforeCursor = text.substring(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex === -1) {
      return null;
    }

    const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
    if (textAfterAt.includes(' ')) {
      return null;
    }

    return {
      startIndex: lastAtIndex,
      query: textAfterAt,
    };
  };

  /**
   * Insertar mención
   */
  const insertMention = (member: WorkspaceMember) => {
    const textarea = textareaRef.current;
    if (!textarea || mentionStartIndex === -1) return;

    const cursorPos = textarea.selectionStart;
    const beforeMention = content.substring(0, mentionStartIndex);
    const afterMention = content.substring(cursorPos);

    const username = member.name.replace(/\s+/g, '');
    const mentionText = `@${username}`;

    const newContent = `${beforeMention}${mentionText} ${afterMention}`;
    setContent(newContent);

    setMentionMap((prev) => ({
      ...prev,
      [mentionText]: member.id,
    }));

    setShowMentionDropdown(false);
    setMentionQuery('');
    setMentionStartIndex(-1);
    setSelectedMemberIndex(0);

    setTimeout(() => {
      textarea.focus();
      const newCursorPos = beforeMention.length + mentionText.length + 1;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      adjustTextareaHeight();
    }, 0);
  };

  /**
   * Manejar cambio de contenido
   */
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    const cursorPos = e.target.selectionStart;

    setContent(newContent);

    const mentionTrigger = detectMentionTrigger(newContent, cursorPos);

    if (mentionTrigger && members.length > 0) {
      setShowMentionDropdown(true);
      setMentionStartIndex(mentionTrigger.startIndex);
      setMentionQuery(mentionTrigger.query);
      setSelectedMemberIndex(0);

      // Calcular posición del dropdown
      setTimeout(() => {
        updateDropdownPosition();
      }, 0);
    } else {
      setShowMentionDropdown(false);
      setMentionQuery('');
      setMentionStartIndex(-1);
    }

    adjustTextareaHeight();
  };

  /**
   * Manejar teclas
   */
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentionDropdown && filteredMembers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedMemberIndex((prev) => (prev + 1) % filteredMembers.length);
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedMemberIndex(
          (prev) => (prev - 1 + filteredMembers.length) % filteredMembers.length
        );
        return;
      }

      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(filteredMembers[selectedMemberIndex]);
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        setShowMentionDropdown(false);
        return;
      }
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
      return;
    }

    if (e.key === 'Escape' && isEditing && onCancel) {
      e.preventDefault();
      onCancel();
    }
  };

  /**
   * Manejar envío
   */
  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();

    if (!content.trim() || isSubmitting || isLoading) {
      return;
    }

    setIsSubmitting(true);

    try {
      const mentionIds = extractMentionIds(content);

      await onSubmit(content, mentionIds.length > 0 ? mentionIds : undefined);

      if (!isEditing) {
        setContent('');
        setMentionMap({});
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
      }
    } catch (error) {
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Manejar cancelación
   */
  const handleCancel = () => {
    setContent(initialValue);
    setMentionMap({});
    setShowMentionDropdown(false);
    onCancel?.();
  };

  /**
   * Scroll dropdown
   */
  useEffect(() => {
    if (dropdownRef.current && showMentionDropdown) {
      const selectedElement = dropdownRef.current.querySelector(
        `[data-index="${selectedMemberIndex}"]`
      ) as HTMLElement;

      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedMemberIndex, showMentionDropdown]);

  const loading = isSubmitting || isLoading;
  const isEmpty = !content.trim();
  const mentionedUserNames = getMentionedUserNames();

  return (
    <form onSubmit={handleSubmit} className="space-y-3 relative">
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

        <div className="flex-1 relative">
          {/* Container con fondo */}
          <div className="relative rounded-md border border-input bg-background">
            {/* Highlight overlay - menciones visibles en azul */}
            <div
              ref={highlightRef}
              className="absolute inset-0 pointer-events-none overflow-hidden whitespace-pre-wrap break-words text-sm px-3 py-2"
              style={{
                lineHeight: '1.5',
                zIndex: 1,
              }}
            >
              {renderHighlightedText()}
            </div>

            {/* Textarea */}
            <Textarea
              ref={textareaRef}
              value={content}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onScroll={syncScroll}
              placeholder={resolvedPlaceholder}
              disabled={loading}
              autoFocus={autoFocus}
              className="min-h-[80px] resize-none relative bg-transparent border-0 focus-visible:ring-0"
              style={{
                zIndex: 2,
              }}
              rows={3}
            />
          </div>

          {mentionedUserNames.length > 0 && !showMentionDropdown && (
            <div className="mt-2 flex items-center gap-2 text-xs text-blue-500">
              <AtSign className="h-3 w-3" />
              <span>{t.comments_mentioning(mentionedUserNames.join(', '))}</span>
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

      {showMentionDropdown && (
        <div
          ref={dropdownRef}
          className="fixed bg-popover border border-border rounded-md shadow-lg overflow-hidden"
          style={{
            width: '280px',
            maxHeight: '200px',
            zIndex: 99999,
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
          }}
        >
          {/* Header del dropdown */}
          <div className="px-3 py-2 bg-muted/50 border-b border-border/50">
            <p className="text-xs font-medium text-muted-foreground">
              {t.comments_mention_header} {mentionQuery && `"${mentionQuery}"`}
            </p>
          </div>

          {/* Lista de miembros */}
          <div className="max-h-[160px] overflow-y-auto">
            {filteredMembers.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                {t.comments_mention_no_results}
              </div>
            ) : (
              filteredMembers.map((member, index) => (
                <button
                  key={member.id}
                  type="button"
                  data-index={index}
                  onClick={() => insertMention(member)}
                  className={`
                w-full flex items-center gap-2 px-3 py-2 text-left text-sm
                transition-colors border-b border-border/50 last:border-b-0
                ${
                  index === selectedMemberIndex
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-muted'
                }
              `}
                >
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarImage
                      src={getAvatarUrl(member.avatar) || undefined}
                      alt={member.name}
                      crossOrigin="anonymous"
                    />
                    <AvatarFallback className="text-[10px]">
                      {member.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{member.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

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
