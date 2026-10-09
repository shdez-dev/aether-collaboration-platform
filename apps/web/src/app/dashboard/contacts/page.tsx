'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Clock3,
  Languages,
  Mail,
  MapPin,
  MessageCircle,
  Search,
  Send,
  ShieldCheck,
  Star,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { apiService } from '@/services/apiService';
import { socketService } from '@/services/socketService';
import { useAuthStore } from '@/stores/authStore';
import { getAvatarUrl } from '@/lib/utils/avatar';
import styles from './ContactsMessenger.module.css';

type Person = {
  id: string;
  name: string;
  email?: string;
  avatar?: string | null;
  position?: string | null;
  bio?: string | null;
  location?: string | null;
  timezone?: string | null;
  language?: string | null;
  createdAt?: string | null;
};
type Conversation = Person & {
  contact_id: string;
  last_body: string | null;
  last_message_at: string | null;
  unread_count: number;
};
type Request = Person & { user_id: string; created_at: string; direction: 'incoming' | 'outgoing' };
type Message = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  expires_at: string;
  read_at: string | null;
};
type Eligibility = {
  canMessage: boolean;
  relationship: 'shared' | 'connected' | 'incoming' | 'outgoing' | 'declined' | 'none';
};
type Detail = Person & {
  sharedItems: { id: string; name: string; kind: 'workspace' | 'team' | 'project' }[];
  eligibility?: Eligibility;
};
type Tab = 'chats' | 'people' | 'requests';

function Avatar({ person, size = 42 }: { person: Person; size?: number }) {
  const [failed, setFailed] = useState(false);
  const url = getAvatarUrl(person.avatar);
  return (
    <span
      className={styles.avatar}
      style={{ width: size, height: size, flexBasis: size, fontSize: Math.max(14, size * 0.3) }}
    >
      {url && !failed ? (
        <img src={url} alt="" onError={() => setFailed(true)} />
      ) : (
        (person.name || '?').trim().charAt(0).toLocaleUpperCase('es')
      )}
    </span>
  );
}

function time(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (date.toDateString() === new Date().toDateString())
    return date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  return date.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
}

export default function ContactsPage() {
  const userId = useAuthStore((state) => state.user?.id);
  const [tab, setTab] = useState<Tab>('chats');
  const [query, setQuery] = useState('');
  const [people, setPeople] = useState<Person[]>([]);
  const [favorites, setFavorites] = useState<Person[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [selected, setSelected] = useState<Detail | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasOlder, setHasOlder] = useState(false);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [profileOpen, setProfileOpen] = useState(true);
  const [mobileDetail, setMobileDetail] = useState(false);
  const searchSequence = useRef(0);
  const selectionSequence = useRef(0);
  const activeConversation = useRef<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const profileToggleRef = useRef<HTMLButtonElement>(null);
  const olderPosition = useRef<{ height: number; top: number } | null>(null);

  useEffect(() => {
    activeConversation.current = conversationId;
  }, [conversationId]);
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    if (olderPosition.current) {
      list.scrollTop = olderPosition.current.top + list.scrollHeight - olderPosition.current.height;
      olderPosition.current = null;
    } else if (stickToBottom.current) {
      const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      list.scrollTo({ top: list.scrollHeight, behavior: reducedMotion ? 'auto' : 'smooth' });
    }
  }, [conversationId, messages.length]);

  useEffect(() => {
    if (!profileOpen || !selected) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setProfileOpen(false);
        profileToggleRef.current?.focus();
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [profileOpen, selected]);

  const refresh = useCallback(async () => {
    const [chats, contacts, pending, saved] = await Promise.all([
      apiService.get<{ conversations: Conversation[] }>('/api/chat/conversations', true),
      apiService.get<{ contacts: Person[] }>('/api/chat/contacts', true),
      apiService.get<{ requests: Request[] }>('/api/chat/requests', true),
      apiService.get<{ favorites: Person[] }>('/api/users/favorites', true),
    ]);
    if (chats.success) setConversations(chats.data?.conversations ?? []);
    if (contacts.success) setPeople(contacts.data?.contacts ?? []);
    if (pending.success) setRequests(pending.data?.requests ?? []);
    if (saved.success) setFavorites(saved.data?.favorites ?? []);
    setLoading(false);
  }, []);

  const loadMessages = useCallback(async (id: string) => {
    const response = await apiService.get<{ messages: Message[] }>(
      `/api/chat/conversations/${id}/messages`,
      true
    );
    if (activeConversation.current !== id) return;
    if (!response.success) {
      setError(response.error?.message ?? 'No se pudieron cargar los mensajes.');
      return;
    }
    setMessages(response.data?.messages ?? []);
    setHasOlder((response.data?.messages?.length ?? 0) === 50);
    void apiService.post(`/api/chat/conversations/${id}/read`, {}, true);
    setConversations((current) =>
      current.map((c) => (c.id === id ? { ...c, unread_count: 0 } : c))
    );
  }, []);

  useEffect(() => {
    void refresh();
    const onChange = (payload: { conversationId?: string }) => {
      void refresh();
      if (payload?.conversationId && activeConversation.current === payload.conversationId)
        void loadMessages(payload.conversationId);
    };
    const onRead = () => {
      void refresh();
    };
    socketService.on('chat:message', onChange);
    socketService.on('chat:request', onChange);
    socketService.on('chat:request-updated', onChange);
    socketService.on('chat:read', onRead);
    socketService.onConnect(onRead);
    return () => {
      socketService.off('chat:message', onChange);
      socketService.off('chat:request', onChange);
      socketService.off('chat:request-updated', onChange);
      socketService.off('chat:read', onRead);
      socketService.offConnect(onRead);
    };
  }, [refresh, loadMessages]);

  useEffect(() => {
    const value = query.trim();
    const sequence = ++searchSequence.current;
    if (value.length < 3) {
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      const response = await apiService.get<{ users: Person[] }>(
        `/api/users/search?q=${encodeURIComponent(value)}&limit=50`,
        true
      );
      if (sequence !== searchSequence.current) return;
      if (response.success) setPeople(response.data?.users ?? []);
      else setError(response.error?.message ?? 'No se pudo buscar personas.');
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  async function fetchProfile(person: Person, sequence: number) {
    try {
      const [detail, access] = await Promise.all([
        apiService.get<{
          user: Person;
          sharedWorkspaces: { id: string; name: string }[];
          sharedTeams: { id: string; name: string }[];
          sharedProjects: { id: string; name: string }[];
        }>(`/api/users/${person.id}`, true),
        apiService.get<Eligibility>(`/api/chat/eligibility/${person.id}`, true),
      ]);
      if (sequence !== selectionSequence.current) return;
      if (!detail.success || !detail.data?.user) {
        setProfileError(detail.error?.message ?? 'No se pudo cargar el perfil.');
      } else {
        const profileUser = detail.data.user;
        const sharedItems: Detail['sharedItems'] = [
          ...(detail.data.sharedWorkspaces ?? []).map((item) => ({
            ...item,
            kind: 'workspace' as const,
          })),
          ...(detail.data.sharedTeams ?? []).map((item) => ({ ...item, kind: 'team' as const })),
          ...(detail.data.sharedProjects ?? []).map((item) => ({
            ...item,
            kind: 'project' as const,
          })),
        ];
        setSelected((current) =>
          current?.id === person.id
            ? {
                ...current,
                ...profileUser,
                sharedItems,
                eligibility: access.success ? access.data : current.eligibility,
              }
            : current
        );
        setProfileError('');
      }
      if (!access.success)
        setError(access.error?.message ?? 'No se pudo consultar el acceso a este contacto.');
      else
        setSelected((current) =>
          current?.id === person.id ? { ...current, eligibility: access.data } : current
        );
    } catch {
      if (sequence === selectionSequence.current) setProfileError('No se pudo cargar el perfil.');
    } finally {
      if (sequence === selectionSequence.current) setProfileLoading(false);
    }
  }

  function choose(person: Person, existingId?: string) {
    const sequence = ++selectionSequence.current;
    setSelected({ ...person, sharedItems: [] });
    setConversationId(existingId ?? null);
    activeConversation.current = existingId ?? null;
    stickToBottom.current = true;
    setMessages([]);
    setHasOlder(false);
    setError('');
    setProfileError('');
    setProfileLoading(true);
    setDraft('');
    setMobileDetail(true);
    setProfileOpen(window.innerWidth > 950);
    if (existingId) void loadMessages(existingId);
    void fetchProfile(person, sequence);
  }

  async function beginChat() {
    if (!selected || busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await apiService.post<{ conversationId: string }>(
        '/api/chat/conversations',
        { userId: selected.id },
        true
      );
      if (!response.success || !response.data) {
        setError(response.error?.message ?? 'No se pudo abrir la conversación.');
        return;
      }
      activeConversation.current = response.data.conversationId;
      setConversationId(response.data.conversationId);
      await loadMessages(response.data.conversationId);
      void refresh();
    } finally {
      setBusy(false);
    }
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!conversationId || !draft.trim() || busy) return;
    setBusy(true);
    setError('');
    stickToBottom.current = true;
    try {
      const response = await apiService.post<{ message: Message }>(
        `/api/chat/conversations/${conversationId}/messages`,
        { body: draft.trim() },
        true
      );
      if (!response.success || !response.data) {
        setError(response.error?.message ?? 'No se pudo enviar el mensaje.');
        return;
      }
      setDraft('');
      setMessages((current) =>
        current.some((m) => m.id === response.data!.message.id)
          ? current
          : [...current, response.data!.message]
      );
      void refresh();
    } finally {
      setBusy(false);
    }
  }

  async function sendRequest() {
    if (!selected || busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await apiService.post('/api/chat/requests', { userId: selected.id }, true);
      if (!response.success) {
        setError(response.error?.message ?? 'No se pudo enviar la solicitud.');
        return;
      }
      setSelected((current) =>
        current
          ? { ...current, eligibility: { canMessage: false, relationship: 'outgoing' } }
          : current
      );
      void refresh();
    } finally {
      setBusy(false);
    }
  }

  async function respond(request: Request, action: 'accept' | 'decline') {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await apiService.post(
        `/api/chat/requests/${request.id}/respond`,
        { action },
        true
      );
      if (!response.success) {
        setError(response.error?.message ?? 'No se pudo responder la solicitud.');
        return;
      }
      await refresh();
      if (selected?.id === request.user_id)
        setSelected((current) =>
          current
            ? {
                ...current,
                eligibility: {
                  canMessage: action === 'accept',
                  relationship: action === 'accept' ? 'connected' : 'declined',
                },
              }
            : current
        );
    } finally {
      setBusy(false);
    }
  }

  async function toggleFavorite() {
    if (!selected || busy) return;
    const saved = favorites.some((p) => p.id === selected.id);
    setBusy(true);
    setError('');
    try {
      const response = saved
        ? await apiService.delete(`/api/users/favorites/${selected.id}`, true)
        : await apiService.post(`/api/users/favorites/${selected.id}`, {}, true);
      if (!response.success) {
        setError(response.error?.message ?? 'No se pudo actualizar favoritos.');
        return;
      }
      setFavorites((current) =>
        saved ? current.filter((p) => p.id !== selected.id) : [...current, selected]
      );
    } finally {
      setBusy(false);
    }
  }

  async function loadOlder() {
    if (!conversationId || !messages.length || busy) return;
    setBusy(true);
    try {
      const response = await apiService.get<{ messages: Message[] }>(
        `/api/chat/conversations/${conversationId}/messages?before=${encodeURIComponent(messages[0].created_at)}`,
        true
      );
      if (!response.success) {
        setError(response.error?.message ?? 'No se pudieron cargar mensajes anteriores.');
        return;
      }
      const older = response.data?.messages ?? [];
      if (listRef.current)
        olderPosition.current = {
          height: listRef.current.scrollHeight,
          top: listRef.current.scrollTop,
        };
      setMessages((current) => [...older, ...current]);
      setHasOlder(older.length === 50);
    } finally {
      setBusy(false);
    }
  }

  const term = query.trim().toLocaleLowerCase('es');
  const incoming = requests.filter((r) => r.direction === 'incoming');
  const uniquePeople = Array.from(
    new Map([...favorites, ...people].map((p) => [p.id, p])).values()
  );
  const visiblePeople = uniquePeople.filter(
    (p) =>
      !term ||
      `${p.name} ${p.email ?? ''} ${p.position ?? ''}`.toLocaleLowerCase('es').includes(term)
  );
  const visibleChats = conversations.filter(
    (c) => !term || `${c.name} ${c.last_body ?? ''}`.toLocaleLowerCase('es').includes(term)
  );
  const visibleRequests = requests.filter(
    (r) => !term || r.name.toLocaleLowerCase('es').includes(term)
  );
  const selectedRequest = incoming.find((r) => r.user_id === selected?.id);
  const isFavorite = favorites.some((p) => p.id === selected?.id);

  return (
    <div className={styles.shell}>
      <aside
        className={`${styles.rail} ${mobileDetail ? styles.mobileHidden : ''}`}
        aria-label="Mensajería y contactos"
      >
        <header className={styles.railHeader}>
          <span className={styles.eyebrow}>TU RED</span>
          <h1>
            Contactos{' '}
            <span className={styles.headingIcon}>
              <MessageCircle size={19} />
            </span>
          </h1>
          <p>Un lugar para conversar y colaborar.</p>
        </header>
        <div className={styles.searchBox}>
          <Search size={17} />
          <input
            aria-label="Buscar por nombre o correo"
            placeholder="Buscar por nombre o correo"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              if (event.target.value.trim().length >= 3) setTab('people');
            }}
          />
          {query && (
            <button
              type="button"
              aria-label="Limpiar búsqueda"
              onClick={() => {
                setQuery('');
                void refresh();
              }}
            >
              <X size={15} />
            </button>
          )}
        </div>
        <nav className={styles.tabs} aria-label="Secciones de contactos">
          <button
            type="button"
            className={tab === 'chats' ? styles.activeTab : ''}
            onClick={() => setTab('chats')}
          >
            Chats
          </button>
          <button
            type="button"
            className={tab === 'people' ? styles.activeTab : ''}
            onClick={() => setTab('people')}
          >
            Personas
          </button>
          <button
            type="button"
            className={tab === 'requests' ? styles.activeTab : ''}
            onClick={() => setTab('requests')}
          >
            Solicitudes
            {incoming.length > 0 && <span className={styles.tabBadge}>{incoming.length}</span>}
          </button>
        </nav>
        <div key={tab} className={styles.railList}>
          {loading && <div className={styles.listHint}>Cargando conversaciones…</div>}
          {!loading && tab === 'chats' && (
            <>
              {visibleChats.length === 0 && (
                <div className={styles.listEmpty}>
                  <MessageCircle size={24} />
                  <strong>{term ? 'Sin resultados' : 'Tus chats aparecerán aquí'}</strong>
                  <p>
                    {term
                      ? 'Prueba otro nombre o busca en Personas.'
                      : 'Abre una conversación desde Personas.'}
                  </p>
                  <button type="button" onClick={() => setTab('people')}>
                    Explorar personas
                  </button>
                </div>
              )}
              {visibleChats.map((chat) => (
                <button
                  type="button"
                  key={chat.id}
                  className={`${styles.personRow} ${selected?.id === chat.contact_id ? styles.selectedRow : ''}`}
                  onClick={() => void choose({ ...chat, id: chat.contact_id }, chat.id)}
                >
                  <Avatar person={chat} />
                  <span className={styles.rowText}>
                    <span className={styles.rowTop}>
                      <strong>{chat.name}</strong>
                      <small>{time(chat.last_message_at)}</small>
                    </span>
                    <span className={styles.rowPreview}>
                      {chat.last_body ?? 'Inicia la conversación'}
                    </span>
                  </span>
                  {chat.unread_count > 0 && (
                    <span className={styles.unread}>{chat.unread_count}</span>
                  )}
                </button>
              ))}
            </>
          )}
          {!loading && tab === 'people' && (
            <>
              {favorites.length > 0 && !term && (
                <div className={styles.listSection}>
                  <Star size={12} /> FAVORITOS
                </div>
              )}
              {visiblePeople.length === 0 && (
                <div className={styles.listEmpty}>
                  <Users size={24} />
                  <strong>
                    {searching
                      ? 'Buscando…'
                      : term.length > 0 && term.length < 3
                        ? 'Escribe al menos 3 caracteres'
                        : 'No hay personas para mostrar'}
                  </strong>
                  <p>Busca por nombre o correo para encontrar a alguien en Aether.</p>
                </div>
              )}
              {visiblePeople.map((person) => (
                <button
                  type="button"
                  key={person.id}
                  className={`${styles.personRow} ${selected?.id === person.id ? styles.selectedRow : ''}`}
                  onClick={() => void choose(person)}
                >
                  <Avatar person={person} />
                  <span className={styles.rowText}>
                    <strong>{person.name}</strong>
                    <span className={styles.rowPreview}>
                      {person.position || person.email || 'Contacto de Aether'}
                    </span>
                  </span>
                  {favorites.some((p) => p.id === person.id) && (
                    <Star size={14} className={styles.favoriteIcon} fill="currentColor" />
                  )}
                </button>
              ))}
            </>
          )}
          {!loading && tab === 'requests' && (
            <>
              {visibleRequests.length === 0 && (
                <div className={styles.listEmpty}>
                  <UserPlus size={24} />
                  <strong>Sin solicitudes</strong>
                  <p>Las solicitudes para conectar aparecerán aquí.</p>
                </div>
              )}
              {visibleRequests.map((request) => (
                <button
                  type="button"
                  key={request.id}
                  className={`${styles.personRow} ${selected?.id === request.user_id ? styles.selectedRow : ''}`}
                  onClick={() => void choose({ ...request, id: request.user_id })}
                >
                  <Avatar person={request} />
                  <span className={styles.rowText}>
                    <strong>{request.name}</strong>
                    <span className={styles.rowPreview}>
                      {request.direction === 'incoming'
                        ? 'Quiere conectar contigo'
                        : 'Solicitud enviada'}
                    </span>
                  </span>
                  {request.direction === 'incoming' && <span className={styles.requestDot} />}
                </button>
              ))}
            </>
          )}
        </div>
        <footer className={styles.railFooter}>
          <ShieldCheck size={15} />
          <span>Conversaciones privadas entre contactos.</span>
        </footer>
      </aside>

      <section
        key={`conversation:${selected?.id ?? 'empty'}`}
        className={`${styles.main} ${!mobileDetail ? styles.mobileHidden : ''}`}
        aria-label="Conversación"
      >
        {!selected ? (
          <div className={styles.welcome}>
            <div className={styles.welcomeArt}>
              <MessageCircle size={34} />
            </div>
            <span className={styles.eyebrow}>CONVERSA EN AETHER</span>
            <h2>
              El trabajo también sucede
              <br />
              en las conversaciones.
            </h2>
            <p>
              Elige un chat o encuentra a una persona para empezar. Todo queda en un espacio
              tranquilo y fácil de seguir.
            </p>
            <button type="button" className={styles.primaryButton} onClick={() => setTab('people')}>
              Ver personas <Users size={16} />
            </button>
          </div>
        ) : (
          <>
            <header className={styles.chatHeader}>
              <button
                type="button"
                className={styles.backButton}
                aria-label="Volver a contactos"
                onClick={() => setMobileDetail(false)}
              >
                <ArrowLeft size={19} />
              </button>
              <Avatar person={selected} size={38} />
              <span className={styles.chatHeading}>
                <strong>{selected.name}</strong>
                <small>{selected.position || 'Conversación privada'}</small>
              </span>
              <button
                type="button"
                ref={profileToggleRef}
                className={styles.profileButton}
                onClick={() => setProfileOpen((value) => !value)}
                aria-label={profileOpen ? 'Ocultar perfil' : 'Mostrar perfil'}
              >
                <Users size={17} />
                <span>Perfil</span>
              </button>
            </header>
            {conversationId ? (
              <>
                <div className={styles.retention}>
                  <Clock3 size={14} /> Los mensajes se eliminan automáticamente después de 30 días.
                </div>
                <div
                  className={styles.messageList}
                  ref={listRef}
                  aria-live="polite"
                  onScroll={(event) => {
                    const list = event.currentTarget;
                    stickToBottom.current =
                      list.scrollHeight - list.scrollTop - list.clientHeight < 100;
                  }}
                >
                  {hasOlder && (
                    <button
                      type="button"
                      className={styles.olderButton}
                      disabled={busy}
                      onClick={() => void loadOlder()}
                    >
                      Cargar mensajes anteriores
                    </button>
                  )}
                  {messages.length === 0 && (
                    <div className={styles.messageEmpty}>
                      <Avatar person={selected} size={62} />
                      <h3>Empieza a conversar con {selected.name.split(' ')[0]}</h3>
                      <p>Un mensaje breve puede abrir una gran colaboración.</p>
                    </div>
                  )}
                  {messages.map((message, index) => {
                    const mine = message.sender_id === userId;
                    const previous = messages[index - 1];
                    const showDate =
                      !previous ||
                      new Date(previous.created_at).toDateString() !==
                        new Date(message.created_at).toDateString();
                    return (
                      <div key={message.id}>
                        {showDate && (
                          <div className={styles.dateDivider}>
                            <span>
                              {new Date(message.created_at).toLocaleDateString('es-CL', {
                                weekday: 'long',
                                day: 'numeric',
                                month: 'long',
                              })}
                            </span>
                          </div>
                        )}
                        <div className={`${styles.messageRow} ${mine ? styles.mine : ''}`}>
                          {!mine && <Avatar person={selected} size={30} />}
                          <div className={styles.messageContent}>
                            <div className={styles.bubble}>{message.body}</div>
                            <time dateTime={message.created_at}>{time(message.created_at)}</time>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <form className={styles.composer} onSubmit={(event) => void send(event)}>
                  <textarea
                    aria-label="Escribir mensaje"
                    placeholder={`Escribe a ${selected.name.split(' ')[0]}…`}
                    value={draft}
                    maxLength={4000}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (
                        event.key === 'Enter' &&
                        !event.shiftKey &&
                        !event.nativeEvent.isComposing
                      ) {
                        event.preventDefault();
                        void send(event);
                      }
                    }}
                  />
                  <div className={styles.composerFooter}>
                    <span>Enter para enviar — Shift + Enter para salto de línea</span>
                    <button
                      type="submit"
                      aria-label="Enviar mensaje"
                      disabled={!draft.trim() || busy}
                    >
                      <Send size={17} />
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className={styles.connectionState}>
                <div className={styles.connectionIcon}>
                  {selected.eligibility?.canMessage ? (
                    <MessageCircle size={29} />
                  ) : (
                    <UserPlus size={29} />
                  )}
                </div>
                <h2>
                  {selected.eligibility?.canMessage
                    ? `Conversa con ${selected.name.split(' ')[0]}`
                    : selected.eligibility?.relationship === 'outgoing'
                      ? 'Solicitud enviada'
                      : selected.eligibility?.relationship === 'incoming'
                        ? 'Quiere conectar contigo'
                        : 'Conecten para conversar'}
                </h2>
                <p>
                  {selected.eligibility?.canMessage
                    ? 'Abre este chat privado para enviar tu primer mensaje.'
                    : selected.eligibility?.relationship === 'outgoing'
                      ? 'Cuando acepte, podrán enviarse mensajes.'
                      : selected.eligibility?.relationship === 'incoming'
                        ? 'Acepta la solicitud para comenzar un chat privado.'
                        : 'Para escribir a alguien fuera de tu organización o espacio, primero deben conectarse.'}
                </p>
                {selected.eligibility?.canMessage ? (
                  <button
                    type="button"
                    className={styles.primaryButton}
                    disabled={busy}
                    onClick={() => void beginChat()}
                  >
                    Abrir conversación <MessageCircle size={16} />
                  </button>
                ) : selected.eligibility?.relationship === 'incoming' && selectedRequest ? (
                  <div className={styles.requestActions}>
                    <button
                      type="button"
                      className={styles.primaryButton}
                      disabled={busy}
                      onClick={() => void respond(selectedRequest, 'accept')}
                    >
                      <Check size={16} /> Aceptar solicitud
                    </button>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      disabled={busy}
                      onClick={() => void respond(selectedRequest, 'decline')}
                    >
                      Rechazar
                    </button>
                  </div>
                ) : selected.eligibility?.relationship === 'outgoing' ? (
                  <span className={styles.pendingPill}>
                    <Clock3 size={14} /> Pendiente de respuesta
                  </span>
                ) : (
                  selected.eligibility && (
                    <button
                      type="button"
                      className={styles.primaryButton}
                      disabled={busy}
                      onClick={() => void sendRequest()}
                    >
                      <UserPlus size={16} /> Enviar solicitud
                    </button>
                  )
                )}
              </div>
            )}
            {error && (
              <div className={styles.error} role="alert">
                {error}
                <button type="button" aria-label="Cerrar error" onClick={() => setError('')}>
                  <X size={14} />
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {selected && (
        <aside
          key={`profile:${selected.id}`}
          className={`${styles.profile} ${!profileOpen ? styles.profileClosed : ''} ${!mobileDetail ? styles.mobileHidden : ''}`}
          aria-label={`Perfil de ${selected.name}`}
          aria-hidden={!profileOpen}
        >
          <div className={styles.profileBanner}>
            <button
              type="button"
              className={styles.profileClose}
              aria-label="Cerrar perfil"
              onClick={() => {
                setProfileOpen(false);
                profileToggleRef.current?.focus();
              }}
            >
              <X size={17} />
            </button>
          </div>
          <div className={styles.profileBody}>
            <div className={styles.profileAvatar}>
              <Avatar person={selected} size={78} />
            </div>
            <div className={styles.profileIdentity}>
              <span className={styles.eyebrow}>PERFIL DE CONTACTO</span>
              <h2>{selected.name}</h2>
              <p>{selected.position || 'Miembro de Aether'}</p>
            </div>
            <button
              type="button"
              className={`${styles.favoriteButton} ${isFavorite ? styles.favoriteActive : ''}`}
              aria-label={isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
              title={isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
              disabled={busy}
              onClick={() => void toggleFavorite()}
            >
              <Star size={17} fill={isFavorite ? 'currentColor' : 'none'} />
            </button>
            <div className={styles.profileRule} />
            {profileLoading && (
              <div className={styles.profileStatus} role="status">
                Cargando información del perfil…
              </div>
            )}
            {profileError && (
              <div className={styles.profileStatus} role="alert">
                <span>{profileError}</span>
                <button
                  type="button"
                  onClick={() => {
                    const sequence = ++selectionSequence.current;
                    setProfileError('');
                    setProfileLoading(true);
                    void fetchProfile(selected, sequence);
                  }}
                >
                  Reintentar
                </button>
              </div>
            )}
            {!profileLoading && !profileError && (
              <>
                <div className={styles.profileBlock}>
                  <span className={styles.profileLabel}>ACERCA DE</span>
                  <p>{selected.bio || 'Aún no ha agregado una biografía a su perfil.'}</p>
                </div>
                <div className={styles.profileBlock}>
                  <span className={styles.profileLabel}>INFORMACIÓN</span>
                  <div className={styles.profileFacts}>
                    {selected.email && (
                      <div className={styles.profileLine}>
                        <Mail size={15} />
                        <span>{selected.email}</span>
                      </div>
                    )}
                    {selected.location && (
                      <div className={styles.profileLine}>
                        <MapPin size={15} />
                        <span>{selected.location}</span>
                      </div>
                    )}
                    {selected.timezone && (
                      <div className={styles.profileLine}>
                        <Clock3 size={15} />
                        <span>{selected.timezone}</span>
                      </div>
                    )}
                    {selected.language && (
                      <div className={styles.profileLine}>
                        <Languages size={15} />
                        <span>
                          {selected.language === 'es'
                            ? 'Español'
                            : selected.language === 'en'
                              ? 'English'
                              : selected.language}
                        </span>
                      </div>
                    )}
                    {selected.createdAt && (
                      <div className={styles.profileLine}>
                        <CalendarDays size={15} />
                        <span>
                          En Aether desde{' '}
                          {new Date(selected.createdAt).toLocaleDateString('es-CL', {
                            month: 'long',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className={styles.profileBlock}>
                  <span className={styles.profileLabel}>EN COMÚN</span>
                  {selected.sharedItems.length ? (
                    <div className={styles.sharedItems}>
                      {selected.sharedItems.map((item) => (
                        <span key={`${item.kind}-${item.id}`}>
                          {item.kind === 'workspace'
                            ? 'Espacio'
                            : item.kind === 'team'
                              ? 'Equipo'
                              : 'Proyecto'}{' '}
                          — {item.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p>Sin espacios, equipos o proyectos compartidos.</p>
                  )}
                </div>
              </>
            )}
            <div className={styles.profileNote}>
              <ShieldCheck size={16} />
              <span>Chat privado. Los mensajes se conservan durante 30 días.</span>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
