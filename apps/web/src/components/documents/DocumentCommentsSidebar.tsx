'use client';
// apps/web/src/components/documents/DocumentCommentsSidebar.tsx

import React, { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import {
  MessageSquare,
  X,
  Check,
  RotateCcw,
  Pencil,
  Trash2,
  Send,
  ChevronDown,
  ChevronRight,
  Reply,
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

// ─────────────────────────────────────────────────────────────────────────────
// Avatar — con fallback a iniciales si la imagen falla
// ─────────────────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  'bg-violet-500',
  'bg-indigo-500',
  'bg-sky-500',
  'bg-teal-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-pink-500',
];

function avatarColor(name: string) {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

function initials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function Avatar({
  name,
  avatar,
  size = 28,
}: {
  name: string;
  avatar?: string | null;
  size?: number;
}) {
  const [imgError, setImgError] = useState(false);

  const style: React.CSSProperties = { width: size, height: size, fontSize: size * 0.38 };

  const resolvedSrc = !imgError ? getAvatarUrl(avatar ?? null) : null;

  if (resolvedSrc) {
    return (
      <img
        src={resolvedSrc}
        alt={name}
        style={style}
        className="rounded-full object-cover flex-shrink-0 ring-1 ring-border/30"
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <span
      style={style}
      className={`${avatarColor(name)} rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0 select-none ring-1 ring-white/10`}
    >
      {initials(name)}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tiempo relativo
// ─────────────────────────────────────────────────────────────────────────────

function RelativeTime({ iso }: { iso: string }) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);

  const label =
    mins < 1
      ? 'ahora'
      : mins < 60
        ? `${mins}m`
        : hours < 24
          ? `${hours}h`
          : days < 7
            ? `${days}d`
            : new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

  return (
    <time className="text-[11px] text-text-muted leading-none" dateTime={iso}>
      {label}
    </time>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Renderiza @menciones en azul accent con subrayado
// Soporta tanto @[Nombre Completo] (formato interno con corchetes)
// como @Palabra (formato simple de una palabra)
// ─────────────────────────────────────────────────────────────────────────────

function Mentions({ text }: { text: string }) {
  // Separa el texto por @[...] o @\w+ y conserva los tokens
  const parts = text.split(/(@\[[^\]]+\]|@\w+)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (!p.startsWith('@')) return <React.Fragment key={i}>{p}</React.Fragment>;
        // Extraer nombre: @[Juan García] → "Juan García" / @Juan → "Juan"
        const name = p.startsWith('@[') ? p.slice(2, -1) : p.slice(1);
        return (
          <span
            key={i}
            className="text-accent font-medium underline underline-offset-2 decoration-accent/60"
          >
            @{name}
          </span>
        );
      })}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Textarea con autocomplete de @menciones
// ─────────────────────────────────────────────────────────────────────────────

interface MentionTextareaProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onMentionSelected?: (memberId: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  members?: { id: string; name: string; avatar?: string | null }[];
}

function MentionTextarea({
  value,
  onChange,
  onSubmit,
  onMentionSelected,
  placeholder,
  autoFocus,
  members = [],
}: MentionTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState(0);
  // Índice seleccionado con teclado en el dropdown
  const [activeIndex, setActiveIndex] = useState(0);

  // auto-resize
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  // Reiniciar índice activo cuando cambia la query
  useEffect(() => {
    setActiveIndex(0);
  }, [mentionQuery]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    onChange(v);
    const cursor = e.target.selectionStart ?? 0;
    // Detectar @ seguido de cualquier carácter (incluyendo espacios) hasta el cursor
    const match = v.slice(0, cursor).match(/@([^@]*)$/);
    if (match) {
      setMentionQuery(match[1]);
      setMentionStart(cursor - match[0].length);
    } else {
      setMentionQuery(null);
    }
  };

  // Insertar la mención con formato @[Nombre Completo] para soportar espacios
  const insertMention = (name: string) => {
    // Capturar el ID ahora mientras members está garantizado cargado
    const member = members.find((mb) => mb.name === name);
    if (member) onMentionSelected?.(member.id);

    const el = ref.current;
    const cursorPos = el
      ? (el.selectionStart ?? mentionStart + name.length + 1)
      : mentionStart + name.length + 1;
    const before = value.slice(0, mentionStart);
    const after = value.slice(cursorPos);
    const mention = `@[${name}] `;
    const newValue = before + mention + after;
    onChange(newValue);
    setMentionQuery(null);
    // Restaurar foco y mover cursor al final de la mención
    setTimeout(() => {
      if (el) {
        const p = (before + mention).length;
        el.focus();
        el.setSelectionRange(p, p);
      }
    }, 0);
  };

  // Lista filtrada de miembros según la query actual
  const filtered =
    mentionQuery !== null
      ? members
          .filter((m) => m.name.toLowerCase().includes(mentionQuery!.toLowerCase()))
          .slice(0, 6)
      : [];

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      onSubmit();
      return;
    }
    if (e.key === 'Escape') {
      setMentionQuery(null);
      return;
    }
    // Navegar el dropdown con flechas y seleccionar con Enter/Tab
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
    }
  };

  return (
    <div className="relative">
      <textarea
        ref={ref}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder ?? 'Escribe un comentario...'}
        autoFocus={autoFocus}
        rows={2}
        className="w-full resize-none bg-surface border border-border rounded-md px-2.5 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/20 transition-colors"
        style={{ minHeight: 52, maxHeight: 160 }}
      />
      {filtered.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 mt-1.5 w-56 bg-card border border-border/80 rounded-lg shadow-2xl z-[9999] overflow-hidden py-1"
          // Evitar que el click en el dropdown quite el foco del textarea
          onMouseDown={(e) => e.preventDefault()}
        >
          <p className="px-3 pt-1 pb-0.5 text-[10px] text-text-muted font-medium uppercase tracking-wider">
            Mencionar usuario
          </p>
          {filtered.map((m, idx) => (
            <button
              key={m.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                insertMention(m.name);
              }}
              className={`flex items-center gap-2.5 w-full px-3 py-2 text-sm text-text-primary transition-colors ${
                idx === activeIndex ? 'bg-accent/15 text-accent' : 'hover:bg-surface'
              }`}
            >
              <Avatar name={m.name} avatar={m.avatar} size={22} />
              <div className="flex flex-col items-start min-w-0">
                <span className="truncate font-medium leading-tight">{m.name}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Formulario de comentario (nuevo o edición)
// ─────────────────────────────────────────────────────────────────────────────

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

function CommentForm({
  onSubmit,
  onCancel,
  placeholder,
  submitLabel = 'Comentar',
  autoFocus,
  initialValue = '',
  members = [],
  t: translations,
}: CommentFormProps) {
  const [content, setContent] = useState(initialValue);
  const [submitting, setSubmitting] = useState(false);
  const mentionIdsRef = useRef<Set<string>>(new Set());

  const handle = async () => {
    const t = content.trim();
    if (!t) return;
    setSubmitting(true);
    try {
      const mentionIds = Array.from(mentionIdsRef.current);
      await onSubmit(t, mentionIds);
      setContent('');
      mentionIdsRef.current = new Set();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-2">
      <MentionTextarea
        value={content}
        onChange={setContent}
        onSubmit={handle}
        onMentionSelected={(id) => mentionIdsRef.current.add(id)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        members={members}
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-text-muted">⌘↵ enviar · @mencionar</span>
        <div className="flex items-center gap-1.5">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-2.5 py-1 text-xs rounded-md text-text-muted hover:text-text-primary hover:bg-surface transition-colors"
            >
              {translations.btn_cancel}
            </button>
          )}
          <button
            type="button"
            onClick={handle}
            disabled={!content.trim() || submitting}
            className="flex items-center gap-1 px-2.5 py-1 text-xs bg-accent text-white rounded-md hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
          >
            <Send className="w-3 h-3" />
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Reply item
// ─────────────────────────────────────────────────────────────────────────────

function ReplyItem({
  reply,
  currentUserId,
  members,
  t,
}: {
  reply: DocumentCommentData;
  currentUserId: string;
  members: { id: string; name: string; avatar?: string | null }[];
  t: any;
}) {
  const { editComment, removeComment } = useDocumentCommentStore();
  const [editing, setEditing] = useState(false);
  const isOwn = reply.createdBy === currentUserId;

  return (
    <div className="group flex gap-2">
      <div className="flex-shrink-0 mt-0.5">
        <Avatar name={reply.user.name} avatar={reply.user.avatar} size={22} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-xs font-medium text-text-primary truncate max-w-[100px]">
            {reply.user.name}
          </span>
          <RelativeTime iso={reply.createdAt} />
          {isOwn && !editing && (
            <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
              <button
                onClick={() => setEditing(true)}
                className="p-0.5 rounded text-text-muted hover:text-text-primary transition-colors"
                title="Editar"
              >
                <Pencil className="w-3 h-3" />
              </button>
              <button
                onClick={() => removeComment(reply.id, reply.documentId)}
                className="p-0.5 rounded text-text-muted hover:text-error transition-colors"
                title="Eliminar"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
        {editing ? (
          <CommentForm
            initialValue={reply.content}
            submitLabel={t.btn_save}
            autoFocus
            members={members}
            onSubmit={async (c, _mentions) => {
              await editComment(reply.id, c);
              setEditing(false);
            }}
            onCancel={() => setEditing(false)}
            t={t}
          />
        ) : (
          <p className="text-sm text-text-primary leading-relaxed break-words">
            <Mentions text={reply.content} />
          </p>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Comment thread
// ─────────────────────────────────────────────────────────────────────────────

function CommentThread({
  comment,
  isActive,
  currentUserId,
  members,
  onFocus,
  documentId,
  t,
}: {
  comment: DocumentCommentData;
  isActive: boolean;
  currentUserId: string;
  members: { id: string; name: string; avatar?: string | null }[];
  onFocus: () => void;
  documentId: string;
  t: any;
}) {
  const { editComment, removeComment, resolveComment, addComment } = useDocumentCommentStore();
  const [editing, setEditing] = useState(false);
  const [replying, setReplying] = useState(false);
  const [showReplies, setShowReplies] = useState(true);

  const isOwn = comment.createdBy === currentUserId;
  const replyCount = comment.replies?.length ?? 0;

  return (
    <div
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest('button, textarea')) onFocus();
      }}
      className={`rounded-xl border transition-all duration-200 cursor-default overflow-hidden ${
        comment.resolved
          ? 'border-border/30 bg-card/30 opacity-55'
          : isActive
            ? 'border-accent/40 bg-card shadow-md shadow-accent/5 ring-1 ring-accent/10'
            : 'border-border/60 bg-card hover:border-border'
      }`}
    >
      {/* Indicador lateral de color */}
      {!comment.resolved && (
        <div
          className={`h-0.5 w-full ${isActive ? 'bg-accent' : 'bg-border/0'} transition-colors`}
        />
      )}

      <div className="p-3">
        {/* Cabecera del thread */}
        <div className="flex items-start gap-2.5">
          <Avatar name={comment.user.name} avatar={comment.user.avatar} size={28} />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-1 mb-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-sm font-semibold text-text-primary truncate">
                  {comment.user.name}
                </span>
                <RelativeTime iso={comment.createdAt} />
              </div>
              {/* Acciones compactas */}
              <div className="flex items-center gap-0.5 flex-shrink-0 ml-1">
                {comment.resolved ? (
                  <>
                    <span className="flex items-center gap-0.5 text-[11px] text-success px-1.5 py-0.5 bg-success/10 rounded-full font-medium">
                      <Check className="w-2.5 h-2.5" />
                      Resuelto
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        resolveComment(comment.id, false);
                      }}
                      className="p-1 rounded text-text-muted hover:text-warning hover:bg-warning/10 transition-colors"
                      title="Reabrir"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      resolveComment(comment.id, true);
                    }}
                    className="p-1 rounded text-text-muted hover:text-success hover:bg-success/10 transition-colors"
                    title="Marcar resuelto"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                )}
                {isOwn && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditing(!editing);
                      }}
                      className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-surface transition-colors"
                      title="Editar"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeComment(comment.id, documentId);
                      }}
                      className="p-1 rounded text-text-muted hover:text-error hover:bg-error/10 transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Contenido */}
            {editing ? (
              <CommentForm
                initialValue={comment.content}
                submitLabel={t.btn_save}
                autoFocus
                members={members}
                onSubmit={async (c, _mentions) => {
                  await editComment(comment.id, c);
                  setEditing(false);
                }}
                onCancel={() => setEditing(false)}
                t={t}
              />
            ) : (
              <p className="text-sm text-text-primary leading-relaxed break-words">
                <Mentions text={comment.content} />
              </p>
            )}
          </div>
        </div>

        {/* Pie: respuestas + botón responder */}
        {!comment.resolved && (
          <div className="mt-2.5 pl-[40px] space-y-2">
            {/* Toggle replies */}
            {replyCount > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowReplies((v) => !v);
                }}
                className="flex items-center gap-1 text-[11px] text-text-muted hover:text-accent transition-colors"
              >
                {showReplies ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
                {replyCount} {replyCount === 1 ? 'respuesta' : 'respuestas'}
              </button>
            )}

            {/* Lista de replies */}
            {showReplies && replyCount > 0 && (
              <div className="space-y-2 pt-1 border-t border-border/30">
                {comment.replies!.map((reply: DocumentCommentData) => (
                  <ReplyItem
                    key={reply.id}
                    reply={reply}
                    currentUserId={currentUserId}
                    members={members}
                    t={t}
                  />
                ))}
              </div>
            )}

            {/* Formulario de respuesta */}
            {replying ? (
              <CommentForm
                placeholder={t.editor_comment_reply_placeholder}
                submitLabel={t.editor_comment_btn_reply}
                autoFocus
                members={members}
                onSubmit={async (c, mentions) => {
                  await addComment(documentId, c, comment.position, comment.id, mentions);
                  setReplying(false);
                }}
                onCancel={() => setReplying(false)}
                t={t}
              />
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setReplying(true);
                }}
                className="flex items-center gap-1 text-[11px] text-text-muted hover:text-accent transition-colors"
              >
                <Reply className="w-3 h-3" />
                Responder
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Panel de nuevo comentario (anclado a selección activa)
// ─────────────────────────────────────────────────────────────────────────────

function NewCommentPanel({
  documentId,
  position,
  selectedText,
  onDone,
  members,
  t,
}: {
  documentId: string;
  position: { from: number; to: number };
  selectedText: string;
  onDone: () => void;
  members: { id: string; name: string; avatar?: string | null }[];
  t: any;
}) {
  const { addComment } = useDocumentCommentStore();
  const currentUser = useAuthStore((s) => s.user);

  return (
    <div className="rounded-xl border border-accent/30 bg-card/80 backdrop-blur-sm p-3 space-y-2.5 shadow-sm">
      {/* Texto seleccionado */}
      {selectedText.trim() && (
        <div className="flex items-start gap-2">
          <div className="w-0.5 self-stretch rounded-full bg-accent flex-shrink-0" />
          <p className="text-xs text-text-muted italic line-clamp-2 leading-relaxed">
            {selectedText}
          </p>
        </div>
      )}
      {/* Autor + forma */}
      <div className="flex items-start gap-2">
        {currentUser && (
          <div className="flex-shrink-0 mt-0.5">
            <Avatar name={currentUser.name} avatar={currentUser.avatar} size={26} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <CommentForm
            placeholder={t.editor_comment_new_placeholder}
            autoFocus
            members={members}
            onSubmit={async (content, mentions) => {
              await addComment(documentId, content, position, null, mentions);
              onDone();
            }}
            onCancel={onDone}
            t={t}
          />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Indicadores de comentario en el margen derecho del editor
// ─────────────────────────────────────────────────────────────────────────────

export interface CommentGutterIndicatorsProps {
  comments: DocumentCommentData[];
  activeCommentId: string | null;
  editorEl: HTMLElement | null;
  scrollEl: HTMLElement | null;
  onIndicatorClick: (commentId: string) => void;
}

export function CommentGutterIndicators({
  comments,
  activeCommentId,
  editorEl,
  scrollEl,
  onIndicatorClick,
}: CommentGutterIndicatorsProps) {
  const [positions, setPositions] = useState<
    { id: string; y: number; comment: DocumentCommentData }[]
  >([]);

  useEffect(() => {
    if (!editorEl || !scrollEl) return;

    const calculate = () => {
      const editorRect = editorEl.getBoundingClientRect();
      const next: typeof positions = [];

      comments
        .filter((c) => !c.resolved && !c.parentId)
        .forEach((comment) => {
          const span = editorEl.querySelector(
            `[data-comment-id="${comment.id}"]`
          ) as HTMLElement | null;
          if (!span) return;

          const spanRect = span.getBoundingClientRect();
          // Posición Y relativa al editorEl (que es position:relative)
          const y = spanRect.top - editorRect.top;
          next.push({ id: comment.id, y, comment });
        });

      // Apilar indicadores demasiado próximos entre sí
      next.sort((a, b) => a.y - b.y);
      const STACK_GAP = 28;
      for (let i = 1; i < next.length; i++) {
        if (next[i].y - next[i - 1].y < STACK_GAP) {
          next[i].y = next[i - 1].y + STACK_GAP;
        }
      }

      setPositions(next);
    };

    calculate();

    const ro = new ResizeObserver(calculate);
    ro.observe(editorEl);
    // Recalcular al hacer scroll (las posiciones viewport cambian aunque el editorEl no)
    scrollEl.addEventListener('scroll', calculate, { passive: true });

    return () => {
      ro.disconnect();
      scrollEl.removeEventListener('scroll', calculate);
    };
  }, [comments, editorEl, scrollEl]);

  if (positions.length === 0) return null;

  return (
    <>
      {positions.map(({ id, y, comment }) => {
        const isActive = activeCommentId === id;
        const replyCount = comment.replies?.length ?? 0;

        return (
          <button
            key={id}
            onClick={() => onIndicatorClick(id)}
            title={`${comment.user.name}: ${comment.content.slice(0, 60)}`}
            style={{ position: 'absolute', top: y - 12, right: 0 }}
            className={`flex items-center gap-1 transition-all duration-150 group ${
              isActive ? 'scale-105 z-20' : 'z-10 hover:scale-105'
            }`}
          >
            {/* Línea conectora */}
            <div
              className={`h-px w-3 transition-colors ${isActive ? 'bg-accent/60' : 'bg-border/60 group-hover:bg-accent/40'}`}
            />
            {/* Chip */}
            <div
              className={`flex items-center gap-1 pl-0.5 pr-1.5 py-0.5 rounded-full border transition-all ${
                isActive
                  ? 'bg-accent/15 border-accent/40 shadow-sm shadow-accent/10'
                  : 'bg-card border-border/60 group-hover:border-accent/40 group-hover:bg-accent/5'
              }`}
            >
              <Avatar name={comment.user.name} avatar={comment.user.avatar} size={20} />
              {replyCount > 0 && (
                <span
                  className={`text-[10px] font-medium leading-none ${isActive ? 'text-accent' : 'text-text-muted'}`}
                >
                  {replyCount}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar principal
// ─────────────────────────────────────────────────────────────────────────────

export interface DocumentCommentsSidebarProps {
  documentId: string;
  canEdit: boolean;
  members?: { id: string; name: string; avatar?: string | null }[];
  onCommentFocus?: (commentId: string, position: { from: number; to: number }) => void;
  selectedText?: string;
}

export function DocumentCommentsSidebar({
  documentId,
  canEdit,
  members = [],
  onCommentFocus,
  selectedText = '',
}: DocumentCommentsSidebarProps) {
  const t = useT();
  const { fetchComments, setActiveComment, setSidebarOpen, setPendingSelection } =
    useDocumentCommentStore();

  const comments = useDocumentCommentStore(selectDocumentComments(documentId));
  const activeCommentId = useDocumentCommentStore(selectActiveCommentId);
  const sidebarOpen = useDocumentCommentStore(selectSidebarOpen);
  const pendingSelection = useDocumentCommentStore(selectPendingSelection);
  const currentUser = useAuthStore((s) => s.user);

  const [showResolved, setShowResolved] = useState(false);
  const activeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchComments(documentId);
  }, [documentId, fetchComments]);

  // Auto-scroll al thread activo
  useEffect(() => {
    if (activeCommentId && activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeCommentId]);

  const openComments = comments.filter((c) => !c.resolved);
  const resolvedComments = comments.filter((c) => c.resolved);
  const visibleComments = showResolved ? comments : openComments;

  if (!sidebarOpen) return null;

  return (
    <div className="flex flex-col h-full w-full bg-surface border-l border-border/60">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/60 flex-shrink-0 bg-card/40">
        <div className="flex items-center gap-2 min-w-0">
          <MessageSquare className="w-3.5 h-3.5 text-accent flex-shrink-0" />
          <span className="text-sm font-semibold text-text-primary truncate">Comentarios</span>
          {openComments.length > 0 && (
            <span className="text-[11px] bg-accent/15 text-accent px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0 leading-none">
              {openComments.length}
            </span>
          )}
        </div>
        <button
          onClick={() => setSidebarOpen(false)}
          className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-surface transition-colors flex-shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Contenido scrollable */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-2.5 py-2.5 space-y-2">
        {/* Panel de nuevo comentario */}
        {pendingSelection && canEdit && (
          <NewCommentPanel
            documentId={documentId}
            position={pendingSelection}
            selectedText={selectedText}
            members={members}
            onDone={() => setPendingSelection(null)}
            t={t}
          />
        )}

        {/* Estado vacío */}
        {visibleComments.length === 0 && !pendingSelection && (
          <div className="flex flex-col items-center justify-center py-10 text-center gap-2.5 px-2">
            <div className="w-9 h-9 rounded-full bg-card flex items-center justify-center border border-border/60">
              <MessageSquare className="w-4 h-4 text-text-muted" />
            </div>
            <p className="text-xs text-text-muted leading-relaxed">
              {canEdit
                ? 'Selecciona texto en el documento\npara añadir un comentario'
                : 'Sin comentarios aún'}
            </p>
          </div>
        )}

        {/* Threads */}
        {visibleComments.map((comment) => (
          <div key={comment.id} ref={activeCommentId === comment.id ? activeRef : undefined}>
            <CommentThread
              comment={comment}
              isActive={activeCommentId === comment.id}
              currentUserId={currentUser?.id ?? ''}
              members={members}
              documentId={documentId}
              onFocus={() => {
                setActiveComment(comment.id);
                onCommentFocus?.(comment.id, comment.position);
              }}
              t={t}
            />
          </div>
        ))}

        {/* Resueltos toggle */}
        {resolvedComments.length > 0 && (
          <button
            onClick={() => setShowResolved((v) => !v)}
            className="flex items-center gap-1.5 w-full text-[11px] text-text-muted hover:text-text-primary py-1.5 border-t border-border/40 transition-colors mt-1"
          >
            {showResolved ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
            {resolvedComments.length} resuelto{resolvedComments.length !== 1 ? 's' : ''}
          </button>
        )}
      </div>
    </div>
  );
}
