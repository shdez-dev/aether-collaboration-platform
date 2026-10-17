'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight, ArrowUpRight, Check, ContactRound, MessageCircle, MessagesSquare,
  RefreshCw, UsersRound,
} from 'lucide-react';
import { apiService } from '@/services/apiService';
import { socketService } from '@/services/socketService';
import { useAuthStore } from '@/stores/authStore';
import { getAvatarUrl } from '@/lib/utils/avatar';
import { usePresence, type PresenceStatus } from '@/components/chat/presence';
import styles from './ContactsDashboardWidgets.module.css';

export type DashboardContact = {
  id: string;
  name: string;
  avatar?: string | null;
  position?: string | null;
};

export type DashboardConversation = DashboardContact & {
  id: string;
  contact_id: string;
  last_body: string | null;
  last_message_at: string | null;
  unread_count: number;
};

type ContactWidgetData = {
  contacts: DashboardContact[];
  conversations: DashboardConversation[];
  contactsLoading: boolean;
  conversationsLoading: boolean;
  contactsError: boolean;
  conversationsError: boolean;
  refresh: () => void;
};

export function useContactWidgetData(onlineEnabled: boolean, recentEnabled: boolean): ContactWidgetData {
  const [contacts, setContacts] = useState<DashboardContact[]>([]);
  const [conversations, setConversations] = useState<DashboardConversation[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [contactsError, setContactsError] = useState(false);
  const [conversationsError, setConversationsError] = useState(false);
  const contactsLoaded = useRef(false);
  const conversationsLoaded = useRef(false);
  const requestSequence = useRef(0);
  const enabled = onlineEnabled || recentEnabled;

  const refresh = useCallback(async () => {
    if (!onlineEnabled && !recentEnabled) return;
    const sequence = ++requestSequence.current;
    if (onlineEnabled && !contactsLoaded.current) setContactsLoading(true);
    if (recentEnabled && !conversationsLoaded.current) setConversationsLoading(true);

    try {
      const [contactResponse, conversationResponse] = await Promise.all([
        onlineEnabled ? apiService.get<{ contacts: DashboardContact[] }>('/api/chat/contacts', true) : Promise.resolve(null),
        recentEnabled ? apiService.get<{ conversations: DashboardConversation[] }>('/api/chat/conversations', true) : Promise.resolve(null),
      ]);
      if (sequence !== requestSequence.current) return;

      if (contactResponse) {
        if (contactResponse.success) {
          setContacts(contactResponse.data?.contacts ?? []);
          setContactsError(false);
        } else setContactsError(true);
        contactsLoaded.current = true;
        setContactsLoading(false);
      }
      if (conversationResponse) {
        if (conversationResponse.success) {
          setConversations(conversationResponse.data?.conversations ?? []);
          setConversationsError(false);
        } else setConversationsError(true);
        conversationsLoaded.current = true;
        setConversationsLoading(false);
      }
    } catch {
      if (sequence !== requestSequence.current) return;
      if (onlineEnabled) {
        contactsLoaded.current = true;
        setContactsError(true);
        setContactsLoading(false);
      }
      if (recentEnabled) {
        conversationsLoaded.current = true;
        setConversationsError(true);
        setConversationsLoading(false);
      }
    }
  }, [onlineEnabled, recentEnabled]);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
    const onChange = () => void refresh();
    const onVisible = () => { if (!document.hidden) void refresh(); };
    const fallbackPoll = window.setInterval(() => {
      if (!document.hidden && !socketService.isConnected()) void refresh();
    }, 12000);
    socketService.on('chat:message', onChange);
    socketService.on('chat:request', onChange);
    socketService.on('chat:request-updated', onChange);
    socketService.on('chat:read', onChange);
    socketService.onConnect(refresh);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      requestSequence.current += 1;
      window.clearInterval(fallbackPoll);
      socketService.off('chat:message', onChange);
      socketService.off('chat:request', onChange);
      socketService.off('chat:request-updated', onChange);
      socketService.off('chat:read', onChange);
      socketService.offConnect(refresh);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, refresh]);

  const retry = useCallback(() => {
    if (onlineEnabled) { contactsLoaded.current = false; setContactsError(false); }
    if (recentEnabled) { conversationsLoaded.current = false; setConversationsError(false); }
    void refresh();
  }, [onlineEnabled, recentEnabled, refresh]);

  return { contacts, conversations, contactsLoading, conversationsLoading, contactsError, conversationsError, refresh: retry };
}

function ContactAvatar({ contact, status, size = 34 }: { contact: DashboardContact; status?: PresenceStatus; size?: number }) {
  const [failed, setFailed] = useState(false);
  const avatar = getAvatarUrl(contact.avatar);
  return <span className={styles.avatarWrap} style={{ width: size, height: size, flexBasis: size }} aria-hidden="true">
    <span className={styles.avatar}>
      {avatar && !failed ? <Image src={avatar} alt="" width={size} height={size} unoptimized onError={() => setFailed(true)} /> : (contact.name || '?').trim().charAt(0).toLocaleUpperCase('es')}
    </span>
    {status && <span className={`${styles.presenceDot} ${styles[status.toLowerCase()]}`} />}
  </span>;
}

function openConversation(contact: DashboardContact | DashboardConversation) {
  const userId = 'contact_id' in contact ? contact.contact_id : contact.id;
  window.dispatchEvent(new CustomEvent('aether:open-chat', { detail: { ...contact, id: userId, userId } }));
}

function ContactLoadingRows({ count = 2, label = 'contactos' }: { count?: number; label?: string }) {
  return <div className={styles.loadingRows} role="status" aria-label={`Cargando ${label}`}>
    {Array.from({ length: count }, (_, index) => <div className={styles.skeletonRow} key={index}><i /><span><b /><small /></span></div>)}
  </div>;
}

function ContactError({ onRetry, label }: { onRetry: () => void; label: string }) {
  return <div className={styles.emptyState}>
    <span className={styles.emptyMark}><RefreshCw size={16} /></span>
    <span className={styles.emptyCopy}><strong>No se pudo actualizar</strong><small>Inténtalo de nuevo en un momento.</small></span>
    <button type="button" className={styles.retryButton} onClick={onRetry} aria-label={`Reintentar ${label}`} title="Volver a cargar"><RefreshCw size={13} /></button>
  </div>;
}

export function ContactsOnlineWidget({ data }: { data: ContactWidgetData }) {
  const userId = useAuthStore((state) => state.user?.id);
  const presence = usePresence(userId);
  const [filter, setFilter] = useState<'ONLINE' | 'AWAY'>('ONLINE');
  const onlineContacts = useMemo(() => data.contacts.filter((contact) => presence.statusFor(contact.id) === 'ONLINE'), [data.contacts, presence]);
  const awayContacts = useMemo(() => data.contacts.filter((contact) => presence.statusFor(contact.id) === 'AWAY'), [data.contacts, presence]);
  const visibleContacts = filter === 'ONLINE' ? onlineContacts : awayContacts;
  const isEmptyError = data.contactsError && data.contacts.length === 0;
  const isLoading = data.contactsLoading && data.contacts.length === 0;

  return <section className={`${styles.widget} ${styles.onlineWidget}`} aria-label="Contactos en línea" aria-busy={isLoading}>
    <header className={styles.header}>
      <span className={styles.headerCopy}><strong>Contactos en línea</strong></span>
      <span className={styles.liveCount}><i /><b>{onlineContacts.length}</b><span>ahora</span></span>
    </header>
    <div className={styles.toolbar}>
      <div className={styles.filterGroup} aria-label="Filtrar por estado">
        <button type="button" aria-pressed={filter === 'ONLINE'} onClick={() => setFilter('ONLINE')}>En línea <span>{onlineContacts.length}</span></button>
        <button type="button" aria-pressed={filter === 'AWAY'} onClick={() => setFilter('AWAY')}>Ausentes <span>{awayContacts.length}</span></button>
      </div>
      <Link className={styles.viewLink} href="/dashboard/contacts">Ver contactos <ArrowUpRight size={12} /></Link>
    </div>
    <div className={styles.peopleList}>
      {isLoading ? <ContactLoadingRows label="contactos" /> : isEmptyError ? <ContactError onRetry={data.refresh} label="contactos" /> : visibleContacts.length ? visibleContacts.slice(0, 4).map((contact, index) => <button type="button" key={contact.id} className={styles.personRow} onClick={() => openConversation(contact)} title={`Abrir chat con ${contact.name}`} style={{ '--row-index': index } as React.CSSProperties}>
        <ContactAvatar contact={contact} status={filter} />
        <span className={styles.personCopy}><strong>{contact.name}</strong><small>{contact.position || 'Disponible para conversar'}</small></span>
        <span className={styles.statusLabel}><i />{filter === 'ONLINE' ? 'En línea' : 'Ausente'}</span>
        <span className={styles.rowAction}><MessageCircle size={14} /></span>
      </button>) : <div className={styles.emptyState}>
        <span className={styles.emptyMark}><UsersRound size={16} /></span>
        <span className={styles.emptyCopy}><strong>{filter === 'ONLINE' ? data.contacts.length ? 'No hay contactos en línea' : 'Todavía no tienes contactos' : 'Nadie está ausente'}</strong><small>{filter === 'ONLINE' ? data.contacts.length ? 'Cuando alguien se conecte, aparecerá aquí.' : 'Al agregar personas, su disponibilidad aparecerá aquí.' : 'Tus contactos disponibles están en línea.'}</small></span>
      </div>}
    </div>
    {data.contactsError && data.contacts.length > 0 && <span className={styles.staleNote}>Mostrando la última lista disponible</span>}
  </section>;
}

function conversationTime(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60_000));
  if (minutes < 1) return 'ahora';
  if (minutes < 60) return `${minutes} min`;
  if (date.toDateString() === new Date().toDateString()) return date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'ayer';
  return date.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
}

export function RecentConversationsWidget({ data }: { data: ContactWidgetData }) {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const conversations = useMemo(() => [...data.conversations].sort((left, right) => {
    const a = left.last_message_at ? new Date(left.last_message_at).getTime() : 0;
    const b = right.last_message_at ? new Date(right.last_message_at).getTime() : 0;
    return b - a;
  }), [data.conversations]);
  const unread = conversations.filter((conversation) => conversation.unread_count > 0);
  const visible = filter === 'unread' ? unread : conversations;
  const isEmptyError = data.conversationsError && data.conversations.length === 0;
  const isLoading = data.conversationsLoading && data.conversations.length === 0;

  return <section className={`${styles.widget} ${styles.recentWidget}`} aria-label="Conversaciones recientes" aria-busy={isLoading}>
    <header className={styles.header}>
      <span className={styles.headerCopy}><strong>Conversaciones recientes</strong></span>
      {unread.length > 0 && <span className={styles.unreadSummary}><i /><b>{unread.length}</b><span>chats sin leer</span></span>}
    </header>
    <div className={styles.toolbar}>
      <div className={styles.filterGroup} aria-label="Filtrar conversaciones">
        <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>Todas <span>{conversations.length}</span></button>
        <button type="button" aria-pressed={filter === 'unread'} onClick={() => setFilter('unread')}>Sin leer <span>{unread.length}</span></button>
      </div>
      <Link className={styles.viewLink} href="/dashboard/contacts">Abrir mensajes <ArrowUpRight size={12} /></Link>
    </div>
    <div className={styles.conversationList}>
      {isLoading ? <ContactLoadingRows count={3} label="conversaciones" /> : isEmptyError ? <ContactError onRetry={data.refresh} label="conversaciones" /> : visible.length ? visible.slice(0, 4).map((conversation, index) => <button type="button" key={conversation.id} className={`${styles.conversationRow} ${conversation.unread_count > 0 ? styles.conversationUnread : ''}`} onClick={() => openConversation(conversation)} title={`Abrir conversación con ${conversation.name}`} style={{ '--row-index': index } as React.CSSProperties}>
        <ContactAvatar contact={conversation} size={34} />
        <span className={styles.conversationCopy}>
          <span className={styles.conversationTopline}><strong>{conversation.name}</strong><time>{conversationTime(conversation.last_message_at)}</time></span>
          <span className={styles.conversationMessage}><small title={conversation.last_body?.trim() || undefined}>{conversation.last_body?.trim() || 'Empieza una conversación'}</small>{conversation.unread_count > 0 && <b aria-label={`${conversation.unread_count} mensajes sin leer`}>{conversation.unread_count > 99 ? '99+' : conversation.unread_count}</b>}</span>
        </span>
        <ArrowRight className={styles.conversationArrow} size={14} />
      </button>) : <div className={styles.emptyState}>
        <span className={styles.emptyMark}>{filter === 'unread' ? <Check size={16} /> : <MessagesSquare size={16} />}</span>
        <span className={styles.emptyCopy}><strong>{filter === 'unread' ? 'Todo leído por ahora' : 'Tu próxima conversación empieza aquí'}</strong><small>{filter === 'unread' ? 'No tienes mensajes pendientes.' : 'Tus chats más recientes aparecerán aquí.'}</small></span>
        {filter === 'all' && <Link href="/dashboard/contacts" className={styles.emptyLink}>Buscar personas <ArrowRight size={12} /></Link>}
      </div>}
    </div>
    {data.conversationsError && data.conversations.length > 0 && <span className={styles.staleNote}>Mostrando la última actividad disponible</span>}
  </section>;
}

export function ContactsOnlineCatalogPreview() {
  return <div className={`${styles.catalogPreview} ${styles.onlinePreview}`} aria-hidden="true">
    <span className={styles.previewHeading}><i><ContactRound size={11} /></i><b /><small>2 DISPONIBLES</small></span>
    <span className={styles.previewFilters}><i>En línea · 2</i><em>Ausentes · 1</em></span>
    <span className={styles.previewPerson}><i /><b /><em /></span>
    <span className={styles.previewPerson}><i /><b /><em /></span>
  </div>;
}

export function RecentConversationsCatalogPreview() {
  return <div className={`${styles.catalogPreview} ${styles.recentPreview}`} aria-hidden="true">
    <span className={styles.previewHeading}><i><MessagesSquare size={11} /></i><b /><small>1 NUEVA</small></span>
    <span className={styles.previewConversation}><i /><b /><em><i /></em></span>
    <span className={styles.previewConversation}><i /><b /><em /></span>
    <span className={styles.previewConversation}><i /><b /><em /></span>
  </div>;
}
