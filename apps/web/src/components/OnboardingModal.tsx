'use client';

// Muestra una única vez al usuario nuevo (sin workspaces) para orientarlo
// sobre qué puede hacer en Aether y cómo arrancar.
// Se suprime en localStorage para no volver a aparecer.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, FolderKanban, Users, X, ArrowRight } from 'lucide-react';

const C = {
  bg:      '#0b0d10',
  surface: '#14171c',
  border:  '#1f2329',
  border2: '#2a2f36',
  text:    '#e6e8eb',
  text2:   '#a1a7b0',
  text3:   '#6b7280',
  accent:  '#3b82f6',
  green:   '#10b981',
  purple:  '#a855f7',
};

const STORAGE_KEY = 'aether_onboarding_seen';

interface Props {
  userName: string;
  onCreateManually: () => void;
}

export default function OnboardingModal({ userName, onCreateManually }: Props) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setVisible(true);
    }
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  }

  function goToAiBuilder() {
    dismiss();
    router.push('/dashboard/ai-builder');
  }

  function handleCreateManually() {
    dismiss();
    onCreateManually();
  }

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
      onClick={dismiss}
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
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
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
            onClick={dismiss}
            style={{
              position: 'absolute', top: '16px', right: '16px',
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: C.text3, padding: '4px',
            }}
          >
            <X size={16} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div style={{
              width: '44px', height: '44px', borderRadius: '12px',
              background: `${C.accent}22`, border: `1px solid ${C.accent}44`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: '22px' }}>⚡</span>
            </div>
            <div>
              <p style={{ fontSize: '11px', color: C.text3, marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Bienvenido a</p>
              <p style={{ fontSize: '20px', fontWeight: 700, color: C.text }}>Aether</p>
            </div>
          </div>

          <p style={{ fontSize: '14px', color: C.text2, lineHeight: 1.6 }}>
            Hola <strong style={{ color: C.text }}>{userName.split(' ')[0]}</strong> — Aether te ayuda a organizar tu equipo, repartir tareas y saber en qué está trabajando cada uno. Sin curvas de aprendizaje.
          </p>
        </div>

        {/* Pasos rápidos */}
        <div style={{ padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>
            Cómo funciona
          </p>

          {[
            { icon: <FolderKanban size={15} />, color: C.accent,  title: 'Workspace',  desc: 'El espacio de tu proyecto o equipo. Puede ser tu tesis, tu startup, tu materia.' },
            { icon: <span style={{ fontSize: '14px' }}>📋</span>,  color: C.green,  title: 'Boards & Cards', desc: 'Cada board es un área de trabajo (Backend, Frontend, Diseño). Las cards son tareas concretas.' },
            { icon: <Users size={15} />,         color: C.purple, title: 'Equipo',     desc: 'Invita a tus compañeros. Cada uno ve qué tiene que hacer y cuándo vence.' },
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
            ¿Por dónde quieres empezar?
          </p>

          <button
            onClick={goToAiBuilder}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px', borderRadius: '10px', cursor: 'pointer',
              background: `${C.accent}15`, border: `1px solid ${C.accent}40`,
              color: C.text, transition: 'all 0.15s', textAlign: 'left', width: '100%',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = `${C.accent}25`; e.currentTarget.style.borderColor = `${C.accent}70`; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = `${C.accent}15`; e.currentTarget.style.borderColor = `${C.accent}40`; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Sparkles size={16} color={C.accent} />
              <div>
                <p style={{ fontSize: '13px', fontWeight: 600, color: C.text }}>Crear workspace con IA</p>
                <p style={{ fontSize: '11.5px', color: C.text3 }}>Describe tu proyecto y la IA genera todo el plan</p>
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
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.border2; e.currentTarget.style.color = C.text; e.currentTarget.style.background = C.bg; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border2; e.currentTarget.style.color = C.text2; e.currentTarget.style.background = 'transparent'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <FolderKanban size={16} color={C.text3} />
              <div>
                <p style={{ fontSize: '13px', fontWeight: 600 }}>Crear manualmente</p>
                <p style={{ fontSize: '11.5px', color: C.text3 }}>Configura tu workspace paso a paso</p>
              </div>
            </div>
            <ArrowRight size={14} color={C.text3} />
          </button>

          <button
            onClick={dismiss}
            style={{ fontSize: '12px', color: C.text3, background: 'none', border: 'none', cursor: 'pointer', marginTop: '2px', alignSelf: 'center' }}
          >
            Explorar primero, crear después
          </button>
        </div>
      </div>
    </div>
  );
}
