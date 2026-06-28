'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { apiService } from '@/services/apiService';
import { C } from '@/lib/colors';

const SORA    = "'Sora', system-ui, sans-serif";
const MANROPE = "'Manrope', system-ui, sans-serif";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Contact {
  id: string; name: string; email: string;
  avatar?: string | null; bio?: string | null; position?: string | null;
  isFavorite: boolean; isTeammate: boolean;
}

interface SharedItem { id: string; name: string; kind: 'team' | 'project'; }

interface ContactDetail extends Contact { sharedItems: SharedItem[]; }

type FilterTab = 'todos' | 'favoritos' | 'equipo';

// ── Helpers ───────────────────────────────────────────────────────────────────

const PALETTE = ['#F4905A','#76A878','#7B8EBF','#C4B9D0','#F4B740','#E07B7B','#86B5C0'];

function hashColor(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return PALETTE[h % PALETTE.length];
}

function initials(name: string) {
  return name.split(' ').map((n) => n[0] ?? '').join('').toUpperCase().slice(0, 2);
}

// ── Star ──────────────────────────────────────────────────────────────────────

function Star({ filled, size = 17 }: { filled: boolean; size?: number }) {
  return filled ? (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#F4B740">
      <path d="m12 3 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19.2l1-5.8L3.5 9.2l5.9-.9Z"
        stroke="#F4B740" strokeWidth="1.2" strokeLinejoin="round"/>
    </svg>
  ) : (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="m12 3 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19.2l1-5.8L3.5 9.2l5.9-.9Z"
        stroke="#5C5447" strokeWidth="1.6" strokeLinejoin="round"/>
    </svg>
  );
}

// ── FilterPill ────────────────────────────────────────────────────────────────

function FilterPill({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={active ? 'fp-active' : 'fp-idle'}
      style={{
        padding: '6px 16px', borderRadius: '20px', border: 'none', cursor: 'pointer',
        fontFamily: SORA, fontSize: '12.5px', fontWeight: 600,
        background: active ? 'var(--c-accent)' : 'rgba(255,255,255,0.05)',
        color: active ? '#24180A' : C.text3,
        transition: 'background 0.2s, color 0.2s, transform 0.15s',
      }}
    >
      {children}
    </button>
  );
}

// ── Skeleton row ──────────────────────────────────────────────────────────────

function SkeletonRow({ delay = 0 }: { delay?: number }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '13px',
      padding: '12px 13px', borderRadius: '8px',
      animation: `fadeIn 0.3s ${delay}s ease both`,
    }}>
      <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', flexShrink: 0, animation: 'shimmer 1.6s ease infinite' }} />
      <div style={{ flex: 1 }}>
        <div style={{ width: '52%', height: 12, borderRadius: 4, background: 'rgba(255,255,255,0.06)', marginBottom: 7, animation: 'shimmer 1.6s 0.1s ease infinite' }} />
        <div style={{ width: '68%', height: 10, borderRadius: 4, background: 'rgba(255,255,255,0.04)', animation: 'shimmer 1.6s 0.2s ease infinite' }} />
      </div>
    </div>
  );
}

// ── ContactRow ────────────────────────────────────────────────────────────────

function ContactRow({ contact, isSelected, index, onSelect, onToggleFav, toggling }: {
  contact: Contact; isSelected: boolean; index: number;
  onSelect: () => void; onToggleFav: (e: React.MouseEvent) => void; toggling: boolean;
}) {
  const [hov, setHov] = useState(false);
  const [starPop, setStarPop] = useState(false);
  const color = hashColor(contact.id);

  const handleFav = (e: React.MouseEvent) => {
    setStarPop(true);
    setTimeout(() => setStarPop(false), 300);
    onToggleFav(e);
  };

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: '13px',
        padding: '11px 13px', borderRadius: '10px', cursor: 'pointer',
        border: isSelected
          ? '1px solid rgba(242,87,30,0.4)'
          : `1px solid ${hov ? 'rgba(255,255,255,0.08)' : 'transparent'}`,
        background: isSelected
          ? 'rgba(242,87,30,0.07)'
          : hov ? 'rgba(255,255,255,0.04)' : 'transparent',
        transition: 'background 0.18s, border-color 0.18s, transform 0.15s',
        transform: hov && !isSelected ? 'translateX(2px)' : 'translateX(0)',
        animation: `fadeIn 0.25s ${index * 0.04}s ease both`,
      }}
    >
      {/* Avatar */}
      <span style={{ position: 'relative', flexShrink: 0 }}>
        <span style={{
          width: 40, height: 40, borderRadius: '50%', background: color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '13px', fontWeight: 700, color: '#24180A', fontFamily: SORA,
          boxShadow: isSelected ? `0 0 0 2px ${color}50` : 'none',
          transition: 'box-shadow 0.2s',
        }}>
          {initials(contact.name)}
        </span>
      </span>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '14px', fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {contact.name}
        </div>
        <div style={{ fontSize: '12px', color: C.text4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>
          {contact.position ? `${contact.position} · ` : ''}{contact.email}
        </div>
      </div>

      {/* Badges */}
      {contact.isTeammate && (
        <span style={{
          fontSize: '10.5px', fontWeight: 600, padding: '2px 7px', borderRadius: '8px',
          background: 'rgba(242,87,30,0.1)', color: '#F4905A', flexShrink: 0,
          opacity: hov || isSelected ? 1 : 0.7, transition: 'opacity 0.2s',
        }}>
          Equipo
        </span>
      )}

      {/* Star */}
      <span
        onClick={handleFav}
        style={{
          flexShrink: 0, width: 30, height: 30,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: '8px', cursor: 'pointer',
          background: hov ? 'rgba(255,255,255,0.06)' : 'transparent',
          opacity: toggling ? 0.4 : 1,
          transform: starPop ? 'scale(1.35)' : 'scale(1)',
          transition: 'background 0.15s, transform 0.2s cubic-bezier(.34,1.56,.64,1)',
        }}
      >
        <Star filled={contact.isFavorite} />
      </span>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ hasSearch }: { hasSearch: boolean }) {
  return (
    <div style={{
      textAlign: 'center', padding: '56px 0',
      animation: 'fadeIn 0.3s ease both',
    }}>
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" style={{ margin: '0 auto 14px', display: 'block', opacity: 0.25 }}>
        <path d="M5 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5V4Z" stroke={C.text} strokeWidth="1.4" strokeLinejoin="round"/>
        <path d="M5 4v16" stroke={C.text} strokeWidth="1.4"/>
        <circle cx="12.5" cy="10.5" r="2" stroke={C.text} strokeWidth="1.4"/>
        <path d="M9.5 16a3 3 0 0 1 6 0" stroke={C.text} strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
      <p style={{ color: C.text4, fontSize: '14px', margin: 0 }}>
        {hasSearch ? 'No encontramos a nadie con esos datos.' : 'No hay contactos aún.'}
      </p>
    </div>
  );
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function DetailPanel({ contact, loading, onToggleFav, toggling, onNavigate }: {
  contact: ContactDetail; loading: boolean;
  onToggleFav: (e: React.MouseEvent) => void; toggling: boolean;
  onNavigate: (kind: 'team' | 'project', id: string) => void;
}) {
  const color = hashColor(contact.id);
  const [starPop, setStarPop] = useState(false);

  const handleFav = (e: React.MouseEvent) => {
    setStarPop(true);
    setTimeout(() => setStarPop(false), 300);
    onToggleFav(e);
  };

  return (
    <div
      key={contact.id}
      style={{
        border: '1px solid rgba(255,255,255,0.09)', borderRadius: '12px',
        background: 'rgba(255,255,255,0.025)', overflow: 'hidden',
        animation: 'slideUp 0.3s cubic-bezier(.22,.9,.36,1) both',
      }}
    >
      {/* Tinted header */}
      <div style={{
        height: '84px', position: 'relative',
        background: `linear-gradient(135deg, ${color}28 0%, ${color}14 100%)`,
        borderBottom: `1px solid ${color}1A`,
      }}>
        <span
          onClick={handleFav}
          style={{
            position: 'absolute', top: 14, right: 14,
            width: 34, height: 34, borderRadius: '50%',
            background: 'rgba(10,14,22,0.5)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', opacity: toggling ? 0.4 : 1,
            transform: starPop ? 'scale(1.3)' : 'scale(1)',
            transition: 'background 0.15s, transform 0.2s cubic-bezier(.34,1.56,.64,1)',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(10,14,22,0.72)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(10,14,22,0.5)'; }}
        >
          <Star filled={contact.isFavorite} size={18} />
        </span>
      </div>

      <div style={{ padding: '0 22px 26px', marginTop: '-40px' }}>
        {/* Avatar */}
        <span style={{
          display: 'inline-flex', width: 78, height: 78, borderRadius: '50%',
          background: color, border: '3px solid #15192E',
          alignItems: 'center', justifyContent: 'center',
          fontFamily: SORA, fontSize: '26px', fontWeight: 700, color: '#24180A',
          boxShadow: `0 0 0 1px ${color}40`,
        }}>
          {initials(contact.name)}
        </span>

        {/* Name */}
        <div style={{ fontFamily: SORA, fontSize: '19px', fontWeight: 700, color: C.text, marginTop: '14px', lineHeight: 1.2 }}>
          {contact.name}
        </div>

        {/* Position + team badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '5px', flexWrap: 'wrap' }}>
          {contact.position && (
            <span style={{ fontSize: '13px', color: C.text3 }}>{contact.position}</span>
          )}
          {contact.isTeammate && contact.position && (
            <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#3F3930', flexShrink: 0 }} />
          )}
          {contact.isTeammate && (
            <span style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              fontSize: '11.5px', fontWeight: 600, color: '#F4905A',
              background: 'rgba(242,87,30,0.1)', padding: '2px 9px', borderRadius: '10px',
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#F4905A' }} />
              Mi equipo
            </span>
          )}
        </div>

        {/* Bio */}
        {contact.bio && (
          <p style={{ fontSize: '13px', color: C.text3, lineHeight: 1.6, margin: '14px 0 0' }}>
            {contact.bio}
          </p>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '18px' }}>
          <a
            href={`mailto:${contact.email}`}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: '7px', padding: '10px', borderRadius: '8px', border: 'none',
              background: 'var(--c-accent)', color: '#24180A',
              fontFamily: SORA, fontWeight: 600, fontSize: '13.5px',
              textDecoration: 'none', transition: 'filter 0.15s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.filter = 'brightness(1.1)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.filter = 'brightness(1)'; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="#24180A" strokeWidth="1.8"/>
              <path d="m4 7 8 6 8-6" stroke="#24180A" strokeWidth="1.8" strokeLinejoin="round"/>
            </svg>
            Mensaje
          </a>
          <a
            href={`mailto:${contact.email}`}
            style={{
              width: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: '8px', border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.03)', textDecoration: 'none',
              transition: 'background 0.15s, border-color 0.15s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.22)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.12)'; }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="#C8BFAE" strokeWidth="1.7"/>
              <path d="m4 7 8 6 8-6" stroke="#C8BFAE" strokeWidth="1.7" strokeLinejoin="round"/>
            </svg>
          </a>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '20px 0' }} />

        {/* Email */}
        <div style={{ fontFamily: SORA, fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4E4538', marginBottom: '10px' }}>
          Correo
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px', fontSize: '13px', color: '#C8BFAE' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
            <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="#615846" strokeWidth="1.6"/>
            <path d="m4 7 8 6 8-6" stroke="#615846" strokeWidth="1.6" strokeLinejoin="round"/>
          </svg>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{contact.email}</span>
        </div>

        {/* En común */}
        {loading ? (
          <div style={{ marginTop: '20px', animation: 'fadeIn 0.2s ease both' }}>
            <div style={{ width: 72, height: 10, borderRadius: 4, background: 'rgba(255,255,255,0.06)', marginBottom: 12, animation: 'shimmer 1.6s ease infinite' }} />
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {[88, 112].map((w, i) => (
                <div key={i} style={{ width: w, height: 30, borderRadius: 8, background: 'rgba(255,255,255,0.05)', animation: `shimmer 1.6s ${i * 0.15}s ease infinite` }} />
              ))}
            </div>
          </div>
        ) : contact.sharedItems.length > 0 ? (
          <div style={{ marginTop: '20px', animation: 'fadeIn 0.35s ease both' }}>
            <div style={{ fontFamily: SORA, fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4E4538', marginBottom: '10px' }}>
              En común
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
              {contact.sharedItems.map((item, i) => (
                <button
                  key={`${item.kind}-${item.id}`}
                  onClick={() => onNavigate(item.kind, item.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    fontSize: '12px', color: '#D8D0C1', fontFamily: MANROPE,
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                    padding: '5px 10px', borderRadius: '8px', cursor: 'pointer',
                    transition: 'background 0.15s, border-color 0.15s, transform 0.15s',
                    animation: `fadeIn 0.25s ${i * 0.05}s ease both`,
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)';
                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.18)';
                    (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)';
                    (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                  }}
                >
                  {item.kind === 'team' ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <circle cx="9" cy="8" r="3" stroke="#F4905A" strokeWidth="1.8"/>
                      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" stroke="#F4905A" strokeWidth="1.8" strokeLinecap="round"/>
                    </svg>
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <rect x="3" y="4" width="7" height="16" rx="1.4" stroke="#C4B9D0" strokeWidth="1.8"/>
                      <rect x="14" y="4" width="7" height="10" rx="1.4" stroke="#C4B9D0" strokeWidth="1.8"/>
                    </svg>
                  )}
                  {item.name}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ── Empty detail placeholder ───────────────────────────────────────────────────

function DetailPlaceholder() {
  return (
    <div style={{
      border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px',
      background: 'rgba(255,255,255,0.015)', padding: '56px 24px',
      textAlign: 'center', animation: 'fadeIn 0.3s ease both',
    }}>
      <svg width="42" height="42" viewBox="0 0 24 24" fill="none" style={{ margin: '0 auto 14px', display: 'block', opacity: 0.2 }}>
        <path d="M5 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5V4Z" stroke={C.text} strokeWidth="1.4" strokeLinejoin="round"/>
        <path d="M5 4v16" stroke={C.text} strokeWidth="1.4"/>
        <circle cx="12.5" cy="10.5" r="2" stroke={C.text} strokeWidth="1.4"/>
        <path d="M9.5 16a3 3 0 0 1 6 0" stroke={C.text} strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
      <p style={{ color: C.text4, fontSize: '13.5px', margin: 0, lineHeight: 1.5 }}>
        Selecciona un contacto<br/>para ver su perfil
      </p>
    </div>
  );
}

// ── Invite modal ──────────────────────────────────────────────────────────────

function InviteButton() {
  const [show, setShow]       = useState(false);
  const [email, setEmail]     = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent]       = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!show) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setShow(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [show]);

  const send = async () => {
    if (!email.trim()) return;
    setSending(true);
    await new Promise((r) => setTimeout(r, 800));
    setSending(false); setSent(true);
    setTimeout(() => { setSent(false); setEmail(''); setShow(false); }, 2000);
  };

  return (
    <>
      <button
        onClick={() => setShow(true)}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '10px 18px', borderRadius: '10px', border: 'none',
          background: 'var(--c-accent)', color: '#24180A',
          fontFamily: SORA, fontWeight: 600, fontSize: '13.5px', cursor: 'pointer',
          transition: 'filter 0.15s, transform 0.15s',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.filter = 'brightness(1.1)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.filter = 'brightness(1)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" stroke="#24180A" strokeWidth="1.9" strokeLinecap="round"/>
          <circle cx="9" cy="7" r="3.4" stroke="#24180A" strokeWidth="1.9"/>
          <path d="M19 8v6M22 11h-6" stroke="#24180A" strokeWidth="1.9" strokeLinecap="round"/>
        </svg>
        Invitar por correo
      </button>

      {show && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)',
          animation: 'fadeIn 0.18s ease both',
        }}>
          <div
            ref={ref}
            style={{
              width: '100%', maxWidth: '420px', margin: '0 16px',
              background: '#1A1410', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '14px', padding: '28px',
              boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
              animation: 'slideUp 0.25s cubic-bezier(.22,.9,.36,1) both',
            }}
          >
            <h2 style={{ fontFamily: SORA, fontWeight: 700, fontSize: '17px', color: C.text, margin: '0 0 5px' }}>
              Invitar por correo
            </h2>
            <p style={{ fontSize: '13px', color: C.text3, margin: '0 0 20px' }}>
              Envía una invitación a tu workspace por email.
            </p>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#827A6D', marginBottom: '8px' }}>
              Correo electrónico
            </label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder="nombre@empresa.com"
              type="email"
              style={{
                width: '100%', padding: '12px 14px', borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.13)',
                background: 'rgba(255,255,255,0.04)',
                color: C.text, fontFamily: MANROPE, fontSize: '14.5px', outline: 'none',
                boxSizing: 'border-box', transition: 'border-color 0.15s',
              }}
              onFocus={(e) => { (e.target as HTMLElement).style.borderColor = 'rgba(242,87,30,0.5)'; }}
              onBlur={(e) => { (e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.13)'; }}
            />
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button
                onClick={() => setShow(false)}
                style={{
                  flex: 1, padding: '11px', borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.13)',
                  background: 'transparent', color: C.text2,
                  fontFamily: SORA, fontWeight: 600, fontSize: '13px', cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                Cancelar
              </button>
              <button
                onClick={send}
                disabled={sending || sent}
                style={{
                  flex: 2, padding: '11px', borderRadius: '8px', border: 'none',
                  background: sent ? '#76A878' : 'var(--c-accent)',
                  color: '#24180A', fontFamily: SORA, fontWeight: 600, fontSize: '13px',
                  cursor: sending || sent ? 'default' : 'pointer',
                  opacity: sending ? 0.7 : 1, transition: 'background 0.2s, opacity 0.2s',
                }}
              >
                {sent ? '¡Enviado!' : sending ? 'Enviando...' : 'Enviar invitación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ContactsPage() {
  const router = useRouter();
  const [mounted, setMounted]   = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [filter, setFilter]     = useState<FilterTab>('todos');
  const [selected, setSelected] = useState<ContactDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [togglingFav, setTogglingFav]     = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setMounted(true); }, []);

  const fetchContacts = useCallback(async (q = '') => {
    setLoading(true);
    try {
      const [uRes, tRes] = await Promise.all([
        apiService.get<{ users: any[] }>(`/api/users?limit=100${q ? `&search=${encodeURIComponent(q)}` : ''}`, true),
        apiService.get<{ teammates: any[] }>('/api/users/me/teammates', true),
      ]);
      const tIds = new Set((tRes.data?.teammates ?? []).map((t: any) => t.id));
      setContacts((uRes.data?.users ?? []).map((u: any) => ({
        id: u.id, name: u.name, email: u.email,
        avatar: u.avatar ?? null, bio: u.bio ?? null, position: u.position ?? null,
        isFavorite: !!u.isFavorite, isTeammate: tIds.has(u.id),
      })));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  const handleSearch = (val: string) => {
    setSearch(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => fetchContacts(val), 350);
  };

  const selectContact = useCallback(async (c: Contact) => {
    setDetailLoading(true);
    setSelected({ ...c, sharedItems: [] });
    try {
      const res = await apiService.get<any>(`/api/users/${c.id}`, true);
      if (res.success && res.data) {
        const items: SharedItem[] = [
          ...(res.data.sharedTeams    ?? []).map((t: any) => ({ id: t.id, name: t.name, kind: 'team'    as const })),
          ...(res.data.sharedProjects ?? []).map((p: any) => ({ id: p.id, name: p.name, kind: 'project' as const })),
        ];
        setSelected((prev) => prev ? { ...prev, sharedItems: items } : prev);
      }
    } finally { setDetailLoading(false); }
  }, []);

  const toggleFav = useCallback(async (e: React.MouseEvent, id: string, fav: boolean) => {
    e.stopPropagation();
    setTogglingFav(id);
    try {
      fav
        ? await apiService.delete(`/api/users/favorites/${id}`, true)
        : await apiService.post(`/api/users/favorites/${id}`, {}, true);
      setContacts((prev) => prev.map((c) => c.id === id ? { ...c, isFavorite: !c.isFavorite } : c));
      setSelected((prev) => prev?.id === id ? { ...prev, isFavorite: !prev.isFavorite } : prev);
    } finally { setTogglingFav(null); }
  }, []);

  const filtered = contacts.filter((c) => {
    if (filter === 'favoritos') return c.isFavorite;
    if (filter === 'equipo')   return c.isTeammate;
    return true;
  });

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: MANROPE }}>

      {/* ── Centered container ── */}
      <div style={{
        maxWidth: '1080px', margin: '0 auto',
        padding: 'clamp(28px, 4vw, 48px) clamp(20px, 3vw, 40px)',
        opacity: mounted ? 1 : 0, transform: mounted ? 'none' : 'translateY(12px)',
        transition: 'opacity 0.4s ease, transform 0.4s ease',
      }}>

        {/* ── Header ── */}
        <div style={{
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
          gap: '16px', flexWrap: 'wrap', marginBottom: '32px',
        }}>
          <div>
            <h1 style={{
              fontFamily: SORA, fontWeight: 700,
              fontSize: 'clamp(1.8rem, 3vw, 2.3rem)', letterSpacing: '-0.025em',
              color: C.text, margin: '0 0 8px',
            }}>
              Contactos
            </h1>
            <p style={{ margin: 0, fontSize: '1rem', color: C.text3, lineHeight: 1.5 }}>
              Las personas con las que compartes equipos y proyectos.
            </p>
          </div>
          <InviteButton />
        </div>

        {/* ── Body ── */}
        <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', flexWrap: 'wrap' }}>

          {/* List column */}
          <section style={{ flex: '1 1 380px', minWidth: '280px' }}>

            {/* Search bar */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '11px 14px', borderRadius: '10px',
              border: '1px solid rgba(255,255,255,0.09)',
              background: 'rgba(255,255,255,0.03)',
              transition: 'border-color 0.2s',
            }}
              onFocus={() => {}}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                <circle cx="11" cy="11" r="7" stroke="#827A6D" strokeWidth="1.8"/>
                <path d="m20 20-3-3" stroke="#827A6D" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              <input
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Buscar por nombre o correo"
                style={{
                  flex: 1, minWidth: 0, border: 'none', background: 'transparent',
                  color: C.text, fontFamily: MANROPE, fontSize: '14.5px', outline: 'none',
                }}
              />
              {search && (
                <button
                  onClick={() => { setSearch(''); fetchContacts(''); }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: C.text4, padding: 0, display: 'flex',
                    transition: 'color 0.15s',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = C.text2; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = C.text4; }}
                >
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M2 2l10 10M12 2L2 12"/>
                  </svg>
                </button>
              )}
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: '7px', margin: '14px 0 12px', flexWrap: 'wrap' }}>
              <FilterPill active={filter === 'todos'}     onClick={() => setFilter('todos')}>Todos</FilterPill>
              <FilterPill active={filter === 'favoritos'} onClick={() => setFilter('favoritos')}>Favoritos</FilterPill>
              <FilterPill active={filter === 'equipo'}    onClick={() => setFilter('equipo')}>Mi equipo</FilterPill>
            </div>

            {/* Count hint */}
            {!loading && filtered.length > 0 && (
              <div style={{
                fontSize: '11.5px', color: C.text4, marginBottom: '8px',
                animation: 'fadeIn 0.2s ease both',
              }}>
                {filtered.length} {filtered.length === 1 ? 'contacto' : 'contactos'}
              </div>
            )}

            {/* List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {loading
                ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} delay={i * 0.05} />)
                : filtered.length === 0
                ? <EmptyState hasSearch={!!search} />
                : filtered.map((c, i) => (
                    <ContactRow
                      key={c.id}
                      contact={c}
                      index={i}
                      isSelected={selected?.id === c.id}
                      onSelect={() => selectContact(c)}
                      onToggleFav={(e) => toggleFav(e, c.id, c.isFavorite)}
                      toggling={togglingFav === c.id}
                    />
                  ))
              }
            </div>
          </section>

          {/* Detail column */}
          <aside style={{ flex: '1 1 300px', maxWidth: '370px', minWidth: '260px', position: 'sticky', top: '24px' }}>
            {selected
              ? <DetailPanel
                  contact={selected}
                  loading={detailLoading}
                  onToggleFav={(e) => toggleFav(e, selected.id, selected.isFavorite)}
                  toggling={togglingFav === selected.id}
                  onNavigate={(kind, id) => router.push(kind === 'project' ? `/dashboard/projects/${id}` : `/dashboard/teams/${id}`)}
                />
              : <DetailPlaceholder />
            }
          </aside>
        </div>
      </div>

      <style>{`
        input::placeholder { color: #614E3A; }
        .fp-idle:hover  { background: rgba(255,255,255,0.08) !important; transform: scale(1.03); }
        .fp-active:hover { filter: brightness(1.08); transform: scale(1.03); }
        @keyframes fadeIn  { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
        @keyframes slideUp { from { opacity:0; transform:translateY(14px) scale(0.98); } to { opacity:1; transform:translateY(0) scale(1); } }
        @keyframes shimmer { 0%,100% { opacity:0.6; } 50% { opacity:1; } }
      `}</style>
    </div>
  );
}
