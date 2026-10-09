'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, ChevronRight, MessageCircle, Search, Send, UserPlus, X } from 'lucide-react';
import { apiService } from '@/services/apiService';
import { socketService } from '@/services/socketService';
import { getAvatarUrl } from '@/lib/utils/avatar';
import styles from './ChatDock.module.css';

type Contact = { id: string; name: string; avatar: string | null; position: string | null };
type Conversation = {
  id: string; contact_id: string; name: string; avatar: string | null; position: string | null;
  last_body: string | null; last_message_at: string | null; unread_count: number;
};
type ContactRequest = Contact & {
  user_id: string; requested_by_id: string; created_at: string;
  direction: 'incoming' | 'outgoing';
};
type Message = {
  id: string; sender_id: string; body: string; created_at: string;
  expires_at: string; read_at: string | null;
};
type Eligibility = { canMessage: boolean; relationship: 'shared' | 'connected' | 'incoming' | 'outgoing' | 'declined' | 'none' };
type Tab = 'chats' | 'contacts' | 'requests';
type ActiveChat = { conversationId: string; contact: Contact };

function Avatar({ contact, size = 36 }: { contact: Contact; size?: number }) {
  const url = getAvatarUrl(contact.avatar);
  return <span className={styles.avatar} style={{ width: size, height: size, flexBasis: size }}>
    {url ? <img src={url} alt="" /> : contact.name.trim().charAt(0).toLocaleUpperCase('es')}
  </span>;
}

function relativeTime(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  return date.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
}

export default function ChatDock({ userId }: { userId?: string }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('chats');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [requests, setRequests] = useState<ContactRequest[]>([]);
  const [active, setActive] = useState<ActiveChat | null>(null);
  const [requestTarget, setRequestTarget] = useState<Contact | null>(null);
  const [targetRelationship, setTargetRelationship] = useState<Eligibility['relationship']>('none');
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const activeRef = useRef<ActiveChat | null>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);

  useEffect(() => { activeRef.current = active; }, [active]);
  useEffect(() => { if (active) messageListRef.current?.scrollTo({ top: messageListRef.current.scrollHeight }); }, [messages, active]);

  const refresh = useCallback(async () => {
    const [contactResponse, conversationResponse, requestResponse] = await Promise.all([
      apiService.get<{ contacts: Contact[] }>('/api/chat/contacts', true),
      apiService.get<{ conversations: Conversation[] }>('/api/chat/conversations', true),
      apiService.get<{ requests: ContactRequest[] }>('/api/chat/requests', true),
    ]);
    if (contactResponse.success) setContacts(contactResponse.data?.contacts ?? []);
    if (conversationResponse.success) setConversations(conversationResponse.data?.conversations ?? []);
    if (requestResponse.success) setRequests(requestResponse.data?.requests ?? []);
  }, []);

  const loadMessages = useCallback(async (conversationId: string) => {
    const response = await apiService.get<{ messages: Message[] }>(`/api/chat/conversations/${conversationId}/messages`, true);
    if (!response.success) { setError(response.error?.message ?? 'No se pudieron cargar los mensajes'); return; }
    setMessages(response.data?.messages ?? []);
    void apiService.post(`/api/chat/conversations/${conversationId}/read`, {}, true);
    setConversations((current) => current.map((item) => item.id === conversationId ? { ...item, unread_count: 0 } : item));
  }, []);

  const startConversation = useCallback(async (contact: Contact) => {
    setBusy(true); setError('');
    try {
      const response = await apiService.post<{ conversationId: string }>('/api/chat/conversations', { userId: contact.id }, true);
      if (!response.success || !response.data) { setError(response.error?.message ?? 'No se pudo abrir la conversación'); return; }
      const chat = { conversationId: response.data.conversationId, contact };
      setActive(chat); setRequestTarget(null); setMessages([]); setDraft('');
      await loadMessages(chat.conversationId);
      void refresh();
    } finally { setBusy(false); }
  }, [loadMessages, refresh]);

  const openWith = useCallback(async (contact: Contact) => {
    setOpen(true); setError('');
    const response = await apiService.get<Eligibility>(`/api/chat/eligibility/${contact.id}`, true);
    if (!response.success || !response.data) { setError(response.error?.message ?? 'No se pudo consultar este contacto'); return; }
    if (response.data.canMessage) { await startConversation(contact); return; }
    setActive(null); setRequestTarget(contact); setTargetRelationship(response.data.relationship);
  }, [startConversation]);

  useEffect(() => {
    if (!userId) return;
    void refresh();
    const onChange = (payload: { conversationId?: string }) => {
      void refresh();
      if (payload?.conversationId && activeRef.current?.conversationId === payload.conversationId) {
        void loadMessages(payload.conversationId);
      }
    };
    const onRead = () => { void refresh(); };
    const onConnect = () => { void refresh(); };
    socketService.on('chat:message', onChange);
    socketService.on('chat:request', onChange);
    socketService.on('chat:request-updated', onChange);
    socketService.on('chat:read', onRead);
    socketService.onConnect(onConnect);
    return () => {
      socketService.off('chat:message', onChange);
      socketService.off('chat:request', onChange);
      socketService.off('chat:request-updated', onChange);
      socketService.off('chat:read', onRead);
      socketService.offConnect(onConnect);
    };
  }, [userId, refresh, loadMessages]);

  useEffect(() => {
    const handler = (event: Event) => {
      const target = (event as CustomEvent<Contact & { userId?: string }>).detail;
      if (!target) return;
      const id = target.userId ?? target.id;
      if (!id) return;
      void openWith({ id, name: target.name ?? 'Contacto', avatar: target.avatar ?? null, position: target.position ?? null });
    };
    window.addEventListener('aether:open-chat', handler);
    return () => window.removeEventListener('aether:open-chat', handler);
  }, [openWith]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    const onMouseDown = (event: MouseEvent) => { if (dockRef.current && !dockRef.current.contains(event.target as Node)) setOpen(false); };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('mousedown', onMouseDown);
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('mousedown', onMouseDown); };
  }, [open]);

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    if (!active || !draft.trim() || busy) return;
    setBusy(true); setError('');
    try {
      const response = await apiService.post<{ message: Message }>(`/api/chat/conversations/${active.conversationId}/messages`, { body: draft.trim() }, true);
      if (!response.success || !response.data) { setError(response.error?.message ?? 'No se pudo enviar el mensaje'); return; }
      setDraft('');
      setMessages((current) => current.some((item) => item.id === response.data!.message.id) ? current : [...current, response.data!.message]);
      void refresh();
    } finally { setBusy(false); }
  }

  async function requestConnection() {
    if (!requestTarget || busy) return;
    setBusy(true); setError('');
    try {
      const response = await apiService.post('/api/chat/requests', { userId: requestTarget.id }, true);
      if (!response.success) { setError(response.error?.message ?? 'No se pudo enviar la solicitud'); return; }
      setTargetRelationship('outgoing');
      void refresh();
    } finally { setBusy(false); }
  }

  async function respond(request: ContactRequest, action: 'accept' | 'decline') {
    setBusy(true); setError('');
    try {
      const response = await apiService.post(`/api/chat/requests/${request.id}/respond`, { action }, true);
      if (!response.success) { setError(response.error?.message ?? 'No se pudo responder'); return; }
      await refresh();
      if (action === 'accept' && requestTarget?.id === request.user_id) {
        void startConversation({ id: request.user_id, name: request.name, avatar: request.avatar, position: request.position });
      }
    } finally { setBusy(false); }
  }

  if (!userId) return null;
  const incomingCount = requests.filter((item) => item.direction === 'incoming').length;
  const unreadCount = conversations.reduce((total, item) => total + Number(item.unread_count || 0), 0);
  const badgeCount = unreadCount + incomingCount;
  const filteredContacts = contacts.filter((item) => `${item.name} ${item.position ?? ''}`.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es')));
  const filteredConversations = conversations.filter((item) => item.name.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es')));

  return <div className={styles.dock} ref={dockRef}>
    {open && <section className={styles.panel} role="dialog" aria-label="Mensajes" id="aether-chat-panel">
      <header className={styles.header}>
        {active || requestTarget ? <button type="button" className={styles.iconButton} aria-label="Volver a los chats" onClick={() => { setActive(null); setRequestTarget(null); setError(''); }}><ArrowLeft size={18} /></button> : <span className={styles.headerIcon}><MessageCircle size={18} /></span>}
        <div className={styles.headerText}><strong>{active?.contact.name ?? requestTarget?.name ?? 'Mensajes'}</strong><small>{active ? 'Chat privado' : requestTarget ? 'Contacto' : 'Conversaciones y contactos'}</small></div>
        <button type="button" className={styles.iconButton} aria-label="Cerrar mensajes" onClick={() => setOpen(false)}><X size={18} /></button>
      </header>

      {active ? <>
        <div className={styles.retention}>Los mensajes se eliminan automáticamente después de 30 días.</div>
        <div className={styles.messageList} ref={messageListRef} aria-live="polite">
          {messages.length === 0 && <div className={styles.empty}>Aún no hay mensajes. Inicia la conversación.</div>}
          {messages.map((message) => <div key={message.id} className={`${styles.message} ${message.sender_id === userId ? styles.ownMessage : ''}`}>
            <p>{message.body}</p><time dateTime={message.created_at}>{relativeTime(message.created_at)}</time>
          </div>)}
        </div>
        <form className={styles.composer} onSubmit={(event) => void sendMessage(event)}>
          <textarea aria-label="Escribir mensaje" placeholder="Escribe un mensaje…" value={draft} maxLength={4000} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendMessage(event); } }} />
          <button type="submit" aria-label="Enviar mensaje" disabled={!draft.trim() || busy}><Send size={17} /></button>
        </form>
      </> : requestTarget ? <div className={styles.requestPrompt}>
        <Avatar contact={requestTarget} size={58} />
        <strong>{requestTarget.name}</strong>
        <p>{targetRelationship === 'outgoing' ? 'La solicitud está pendiente. Podrás escribirle cuando la acepte.' : targetRelationship === 'incoming' ? 'Esta persona quiere agregarte. Revisa la solicitud para comenzar a conversar.' : targetRelationship === 'declined' ? 'La solicitud anterior no fue aceptada. Puedes volver a intentarlo después de 7 días.' : 'Para escribirle fuera de tus organizaciones o espacios compartidos, primero debe aceptar tu solicitud.'}</p>
        {targetRelationship === 'incoming' ? <button type="button" className={styles.primaryButton} onClick={() => { setRequestTarget(null); setTab('requests'); }}>Ver solicitud</button>
          : targetRelationship === 'outgoing' ? <span className={styles.pendingLabel}>Solicitud enviada</span>
          : <button type="button" className={styles.primaryButton} disabled={busy} onClick={() => void requestConnection()}><UserPlus size={16} /> Enviar solicitud</button>}
      </div> : <>
        <nav className={styles.tabs} aria-label="Secciones de mensajes">
          <button type="button" aria-selected={tab === 'chats'} onClick={() => { setTab('chats'); setSearch(''); }}>Chats</button>
          <button type="button" aria-selected={tab === 'contacts'} onClick={() => { setTab('contacts'); setSearch(''); }}>Contactos</button>
          <button type="button" aria-selected={tab === 'requests'} onClick={() => { setTab('requests'); setSearch(''); }}>Solicitudes{incomingCount > 0 ? ` (${incomingCount})` : ''}</button>
        </nav>
        {tab !== 'requests' && <label className={styles.search}><Search size={15} /><input aria-label="Filtrar chats o contactos" placeholder="Buscar…" value={search} onChange={(event) => setSearch(event.target.value)} /></label>}
        <div className={styles.list}>
          {tab === 'chats' && (filteredConversations.length ? filteredConversations.map((conversation) => <button type="button" key={conversation.id} className={styles.row} onClick={() => { const chat = { conversationId: conversation.id, contact: { id: conversation.contact_id, name: conversation.name, avatar: conversation.avatar, position: conversation.position } }; setActive(chat); setMessages([]); void loadMessages(chat.conversationId); }}>
            <Avatar contact={{ id: conversation.contact_id, name: conversation.name, avatar: conversation.avatar, position: conversation.position }} />
            <span className={styles.rowMain}><strong>{conversation.name}</strong><small>{conversation.last_body ?? 'Sin mensajes todavía'}</small></span>
            <span className={styles.rowAside}><small>{relativeTime(conversation.last_message_at)}</small>{conversation.unread_count > 0 && <b>{conversation.unread_count}</b>}</span>
          </button>) : <div className={styles.empty}><MessageCircle size={25} /><strong>No hay chats todavía</strong><span>Elige un contacto para empezar.</span><button type="button" onClick={() => setTab('contacts')}>Ver contactos <ChevronRight size={14} /></button></div>)}
          {tab === 'contacts' && (filteredContacts.length ? filteredContacts.map((contact) => <button type="button" key={contact.id} className={styles.row} onClick={() => void startConversation(contact)}>
            <Avatar contact={contact} /><span className={styles.rowMain}><strong>{contact.name}</strong><small>{contact.position ?? 'Disponible para conversar'}</small></span><ChevronRight size={16} className={styles.chevron} />
          </button>) : <div className={styles.empty}><UserPlus size={25} /><strong>Sin contactos disponibles</strong><span>Busca personas en Contactos para conectar.</span></div>)}
          {tab === 'requests' && (requests.length ? requests.map((request) => <div key={request.id} className={styles.requestRow}>
            <Avatar contact={{ id: request.user_id, name: request.name, avatar: request.avatar, position: request.position }} />
            <div className={styles.requestInfo}><strong>{request.name}</strong><small>{request.direction === 'incoming' ? 'Quiere agregarte' : 'Solicitud enviada'}</small>
              {request.direction === 'incoming' && <span className={styles.requestActions}><button type="button" disabled={busy} onClick={() => void respond(request, 'accept')}><Check size={14} /> Aceptar</button><button type="button" disabled={busy} onClick={() => void respond(request, 'decline')}>Rechazar</button></span>}
            </div>
          </div>) : <div className={styles.empty}><UserPlus size={25} /><strong>Sin solicitudes pendientes</strong><span>Las invitaciones para conectar aparecerán aquí.</span></div>)}
        </div>
        <Link href="/dashboard/contacts" className={styles.directoryLink} onClick={() => setOpen(false)}>Buscar personas en Contactos <ChevronRight size={15} /></Link>
      </>}
      {error && <p className={styles.error} role="alert">{error}</p>}
    </section>}
    <button type="button" className={styles.launcher} aria-label={open ? 'Cerrar mensajes' : 'Abrir mensajes'} aria-controls="aether-chat-panel" aria-expanded={open} onClick={() => { setOpen((value) => !value); if (!open) void refresh(); }}><MessageCircle size={23} fill="none" />{badgeCount > 0 && <span className={styles.badge}>{badgeCount > 99 ? '99+' : badgeCount}</span>}</button>
  </div>;
}
