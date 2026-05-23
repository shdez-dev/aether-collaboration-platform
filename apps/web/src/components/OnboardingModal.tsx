'use client';

// Muestra una única vez al usuario nuevo (sin workspaces) para orientarlo.
// La visibilidad está controlada desde fuera via la prop `open`.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, FolderKanban, Users, X, ArrowRight } from 'lucide-react';
import { C } from '@/lib/colors';
import { useT } from '@/lib/i18n';

interface Props {
  open: boolean;
  userName: string;
  onDismiss: () => void;
  onCreateManually: () => void;
}

export default function OnboardingModal({ open, userName, onDismiss, onCreateManually }: Props) {
  const router = useRouter();
  const t = useT();
  const [animIn, setAnimIn] = useState(false);

  useEffect(() => {
    if (open) {
      const id = requestAnimationFrame(() => setAnimIn(true));
      return () => cancelAnimationFrame(id);
    } else {
      setAnimIn(false);
    }
  }, [open]);

  function goToAiBuilder() {
    onDismiss();
    router.push('/dashboard/ai-builder');
  }

  function handleCreateManually() {
    onDismiss();
    onCreateManually();
  }

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
        opacity: animIn ? 1 : 0,
        transition: 'opacity 0.18s ease',
      }}
      onClick={onDismiss}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.surface,
          border: `1px solid ${C.border2}`,
          borderRadius: '16px',
          width: '100%',
          maxWidth: '520px',
          overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          transform: animIn ? 'scale(1) translateY(0)' : 'scale(0.97) translateY(8px)',
          transition: 'transform 0.18s ease',
        }}
      >
        {/* Header con gradiente */}
        <div style={{
          background: 'linear-gradient(135deg, #1e2a3a 0%, #0f1217 100%)',
          padding: '28px 28px 24px',
          position: 'relative',
          borderBottom: `1px solid ${C.border}`,
        }}>
          <button
            onClick={onDismiss}
            style={{
              position: 'absolute', top: '16px', right: '16px',
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: C.text3, padding: '4px', borderRadius: '5px', lineHeight: 0,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = C.text2)}
            onMouseLeave={(e) => (e.currentTarget.style.color = C.text3)}
          >
            <X size={16} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div style={{
              width: '44px', height: '44px', borderRadius: '12px',
              background: `rgba(56,182,255,0.15)`, border: `1px solid rgba(56,182,255,0.3)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: '22px' }}>⚡</span>
            </div>
            <div>
              <p style={{ fontSize: '11px', color: C.text3, marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{t.onboarding_welcome_to}</p>
              <p style={{ fontSize: '20px', fontWeight: 700, color: C.text }}>Aether</p>
            </div>
          </div>

          <p style={{ fontSize: '14px', color: C.text2, lineHeight: 1.6 }}>
            {t.onboarding_greeting(userName.split(' ')[0])}
          </p>
        </div>

        {/* Pasos rápidos */}
        <div style={{ padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>
            {t.onboarding_how_it_works}
          </p>

          {[
            { icon: <FolderKanban size={15} />, color: C.accent,  title: t.onboarding_step_workspace_title, desc: t.onboarding_step_workspace_desc },
            { icon: <span style={{ fontSize: '14px' }}>📋</span>,  color: C.green,  title: t.onboarding_step_boards_title,    desc: t.onboarding_step_boards_desc },
            { icon: <Users size={15} />,         color: '#a855f7', title: t.onboarding_step_team_title,      desc: t.onboarding_step_team_desc },
          ].map((step, i) => (
            <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0,
                background: `${step.color}18`, border: `1px solid ${step.color}33`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: step.color,
              }}>
                {step.icon}
              </div>
              <div>
                <p style={{ fontSize: '13px', fontWeight: 600, color: C.text, marginBottom: '2px' }}>{step.title}</p>
                <p style={{ fontSize: '12px', color: C.text3, lineHeight: 1.5 }}>{step.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTAs */}
        <div style={{
          padding: '16px 28px 24px',
          display: 'flex', flexDirection: 'column', gap: '10px',
          borderTop: `1px solid ${C.border}`,
        }}>
          <p style={{ fontSize: '12px', color: C.text3, marginBottom: '4px' }}>
            {t.onboarding_where_start}
          </p>

          <button
            onClick={goToAiBuilder}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px', borderRadius: '10px', cursor: 'pointer',
              background: `rgba(56,182,255,0.10)`, border: `1px solid rgba(56,182,255,0.3)`,
              color: C.text, transition: 'all 0.15s', textAlign: 'left', width: '100%',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = `rgba(56,182,255,0.18)`; e.currentTarget.style.borderColor = `rgba(56,182,255,0.5)`; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = `rgba(56,182,255,0.10)`; e.currentTarget.style.borderColor = `rgba(56,182,255,0.3)`; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Sparkles size={16} color={C.accent} />
              <div>
                <p style={{ fontSize: '13px', fontWeight: 600, color: C.text }}>{t.onboarding_ai_title}</p>
                <p style={{ fontSize: '11.5px', color: C.text3 }}>{t.onboarding_ai_desc}</p>
              </div>
            </div>
            <ArrowRight size={14} color={C.text3} />
          </button>

          <button
            onClick={handleCreateManually}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px', borderRadius: '10px', cursor: 'pointer',
              background: 'transparent', border: `1px solid ${C.border2}`,
              color: C.text2, transition: 'all 0.15s', textAlign: 'left', width: '100%',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.text; e.currentTarget.style.background = C.hover; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border2; e.currentTarget.style.color = C.text2; e.currentTarget.style.background = 'transparent'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <FolderKanban size={16} color={C.text3} />
              <div>
                <p style={{ fontSize: '13px', fontWeight: 600 }}>{t.onboarding_manual_title}</p>
                <p style={{ fontSize: '11.5px', color: C.text3 }}>{t.onboarding_manual_desc}</p>
              </div>
            </div>
            <ArrowRight size={14} color={C.text3} />
          </button>

          <button
            onClick={onDismiss}
            style={{ fontSize: '12px', color: C.text3, background: 'none', border: 'none', cursor: 'pointer', marginTop: '2px', alignSelf: 'center' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = C.text2)}
            onMouseLeave={(e) => (e.currentTarget.style.color = C.text3)}
          >
            {t.onboarding_explore_first}
          </button>
        </div>
      </div>
    </div>
  );
}
