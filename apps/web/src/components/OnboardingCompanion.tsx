// components/OnboardingCompanion.tsx
// Companion widget flotante (bottom-right) que guía al usuario durante el onboarding.
// Se muestra hasta que todos los pasos estén completos o el usuario lo descarte.

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import {
  CheckCircle2, Circle, ChevronUp, ChevronDown,
  X, Map, ArrowRight,
} from 'lucide-react';
import { C } from '@/lib/colors';
import {
  getCompletedSteps, markStepDone, isGuideDismissed, dismissGuide,
  GUIDE_STEP_EVENT, GUIDE_DISMISS_EVENT, GUIDE_OPEN_EVENT,
  type GuideStepId,
} from '@/lib/utils/onboardingGuide';
import { useT } from '@/lib/i18n';

// ── Definición de pasos ───────────────────────────────────────────────────────

interface GuideStep {
  id: GuideStepId;
  title: string;
  instruction: string;
  cta: string;
  href: string;
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function OnboardingCompanion() {
  const router = useRouter();
  const t = useT();
  const { workspaces } = useWorkspaceStore();

  const STEPS: GuideStep[] = [
    {
      id: 'workspace',
      title: t.guide_step_workspace_title,
      instruction: t.guide_step_workspace_instruction,
      cta: t.guide_step_workspace_cta,
      href: '/dashboard/workspaces',
    },
    {
      id: 'invite',
      title: t.guide_step_invite_title,
      instruction: t.guide_step_invite_instruction,
      cta: t.guide_step_invite_cta,
      href: '/dashboard/workspaces',
    },
    {
      id: 'project',
      title: t.guide_step_project_title,
      instruction: t.guide_step_project_instruction,
      cta: t.guide_step_project_cta,
      href: '/dashboard/projects',
    },
    {
      id: 'board',
      title: t.guide_step_board_title,
      instruction: t.guide_step_board_instruction,
      cta: t.guide_step_board_cta,
      href: '/dashboard/workspaces',
    },
    {
      id: 'card',
      title: t.guide_step_card_title,
      instruction: t.guide_step_card_instruction,
      cta: t.guide_step_card_cta,
      href: '/dashboard/workspaces',
    },
  ];

  const [dismissed,  setDismissed]  = useState(true);  // true hasta hidratar
  const [expanded,   setExpanded]   = useState(false);
  const [completed,  setCompleted]  = useState<Set<GuideStepId>>(new Set());
  const [allDone,    setAllDone]    = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [hydrated,   setHydrated]   = useState(false);

  // ── Hidratación inicial ──────────────────────────────────────────────────
  useEffect(() => {
    if (isGuideDismissed()) {
      setDismissed(true);
      setHydrated(true);
      return;
    }
    setDismissed(false);
    setCompleted(getCompletedSteps());
    setHydrated(true);
  }, []);

  // ── Auto-detectar workspace desde el store ───────────────────────────────
  useEffect(() => {
    if (!hydrated || dismissed) return;
    if (workspaces.length > 0) {
      markStepDone('workspace');
    }
  }, [hydrated, dismissed, workspaces.length]);

  // ── Escuchar eventos de pasos completados ────────────────────────────────
  const onStepDone = useCallback((e: Event) => {
    const stepId = (e as CustomEvent).detail as GuideStepId;
    setCompleted((prev) => {
      const next = new Set(prev);
      next.add(stepId);
      return next;
    });
  }, []);

  const onDismissed = useCallback(() => {
    setDismissed(true);
  }, []);

  const onOpen = useCallback(() => {
    setDismissed(false);
    setExpanded(true);
    setCompleted(getCompletedSteps());
  }, []);

  useEffect(() => {
    window.addEventListener(GUIDE_STEP_EVENT, onStepDone);
    window.addEventListener(GUIDE_DISMISS_EVENT, onDismissed);
    window.addEventListener(GUIDE_OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener(GUIDE_STEP_EVENT, onStepDone);
      window.removeEventListener(GUIDE_DISMISS_EVENT, onDismissed);
      window.removeEventListener(GUIDE_OPEN_EVENT, onOpen);
    };
  }, [onStepDone, onDismissed, onOpen]);

  // ── Detectar cuando todos los pasos están completos ──────────────────────
  useEffect(() => {
    if (completed.size >= STEPS.length && !allDone) {
      setAllDone(true);
      setCelebrating(true);
      setExpanded(true);
      // Auto-dismiss tras 4s de celebración
      const t = setTimeout(() => {
        dismissGuide();
        setDismissed(true);
      }, 4000);
      return () => clearTimeout(t);
    }
  }, [completed.size, allDone]);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const handleDismiss = () => {
    dismissGuide();
    setDismissed(true);
  };

  const handleCta = (step: GuideStep) => {
    router.push(step.href);
    setExpanded(false);
  };

  // Primer paso no completado
  const currentStep = STEPS.find((s) => !completed.has(s.id)) ?? null;
  const doneCount   = completed.size;
  const totalCount  = STEPS.length;
  const pct         = Math.round((doneCount / totalCount) * 100);

  if (!hydrated || dismissed) return null;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 60,
        width: '300px',
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        filter: 'drop-shadow(0 8px 32px rgba(0,0,0,0.6))',
      }}
    >
      {/* ── Card expandida ── */}
      {expanded && (
        <div
          style={{
            background: C.surface,
            border: `1px solid ${C.border2}`,
            borderRadius: '14px',
            overflow: 'hidden',
            marginBottom: '8px',
            animation: 'guide-slide-up 0.18s ease',
          }}
        >
          <style>{`
            @keyframes guide-slide-up {
              from { opacity: 0; transform: translateY(10px); }
              to   { opacity: 1; transform: translateY(0); }
            }
            @keyframes guide-check {
              0%   { transform: scale(0.6); opacity: 0; }
              60%  { transform: scale(1.15); }
              100% { transform: scale(1); opacity: 1; }
            }
          `}</style>

          {/* Header */}
          <div style={{
            padding: '13px 14px 11px',
            borderBottom: `1px solid ${C.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <div style={{
              width: '26px', height: '26px', borderRadius: '7px', flexShrink: 0,
              background: `rgba(56,182,255,0.12)`, border: `1px solid rgba(56,182,255,0.25)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Map size={13} color={C.accent} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '12.5px', fontWeight: 700, color: C.text, lineHeight: 1 }}>
                {t.guide_title}
              </p>
              <p style={{ fontSize: '11px', color: C.text3, marginTop: '2px' }}>
                {t.guide_progress(doneCount, totalCount)}
              </p>
            </div>
            <button
              onClick={handleDismiss}
              title={t.guide_dismiss}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text4, padding: '2px', borderRadius: '4px', lineHeight: 0 }}
              onMouseEnter={(e) => (e.currentTarget.style.color = C.text2)}
              onMouseLeave={(e) => (e.currentTarget.style.color = C.text4)}
            >
              <X size={13} />
            </button>
          </div>

          {/* Progress bar */}
          <div style={{ height: '3px', background: C.border, position: 'relative' }}>
            <div style={{
              height: '100%', background: C.accent,
              width: `${pct}%`, transition: 'width 0.4s ease',
              boxShadow: `0 0 6px rgba(56,182,255,0.4)`,
            }} />
          </div>

          {/* Celebración */}
          {celebrating && (
            <div style={{ padding: '20px 16px', textAlign: 'center' }}>
              <p style={{ fontSize: '22px', marginBottom: '8px' }}>🎉</p>
              <p style={{ fontSize: '13.5px', fontWeight: 700, color: C.text, marginBottom: '4px' }}>
                {t.guide_done_title}
              </p>
              <p style={{ fontSize: '12px', color: C.text3, lineHeight: 1.5 }}>
                {t.guide_done_body}
              </p>
            </div>
          )}

          {/* Paso activo */}
          {!celebrating && currentStep && (
            <div style={{ padding: '14px 16px 12px', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <span style={{
                  fontSize: '10px', fontWeight: 700, padding: '2px 7px',
                  borderRadius: '20px', background: `rgba(56,182,255,0.12)`,
                  border: `1px solid rgba(56,182,255,0.25)`, color: C.accent,
                }}>
                  {t.guide_step_label(STEPS.findIndex((s) => s.id === currentStep.id) + 1, totalCount)}
                </span>
              </div>
              <p style={{ fontSize: '13.5px', fontWeight: 700, color: C.text, marginBottom: '7px' }}>
                {currentStep.title}
              </p>
              <p style={{ fontSize: '12px', color: C.text3, lineHeight: 1.6, marginBottom: '12px' }}>
                {currentStep.instruction}
              </p>
              <button
                onClick={() => handleCta(currentStep)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  padding: '9px 14px', borderRadius: '8px', cursor: 'pointer',
                  background: C.accent, border: 'none', color: '#fff',
                  fontSize: '12.5px', fontWeight: 600, transition: 'opacity 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.88')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
              >
                {currentStep.cta}
                <ArrowRight size={13} />
              </button>
            </div>
          )}

          {/* Checklist de todos los pasos */}
          <div style={{ padding: '10px 16px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {STEPS.map((step, i) => {
              const done = completed.has(step.id);
              const isCurrent = currentStep?.id === step.id;
              return (
                <div
                  key={step.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '9px',
                    padding: '5px 6px', borderRadius: '6px',
                    background: isCurrent ? `rgba(56,182,255,0.06)` : 'transparent',
                    border: isCurrent ? `1px solid rgba(56,182,255,0.15)` : '1px solid transparent',
                  }}
                >
                  {done ? (
                    <CheckCircle2
                      size={15}
                      color="#22c55e"
                      style={{ flexShrink: 0, animation: 'guide-check 0.25s ease' }}
                    />
                  ) : (
                    <Circle size={15} color={isCurrent ? C.accent : C.border2} style={{ flexShrink: 0 }} />
                  )}
                  <span style={{
                    fontSize: '12px',
                    color: done ? C.text3 : isCurrent ? C.text : C.text2,
                    textDecoration: done ? 'line-through' : 'none',
                    fontWeight: isCurrent ? 600 : 400,
                  }}>
                    {step.title}
                  </span>
                  {isCurrent && (
                    <div style={{
                      marginLeft: 'auto', width: '6px', height: '6px', borderRadius: '50%',
                      background: C.accent, flexShrink: 0,
                      boxShadow: `0 0 4px ${C.accent}`,
                    }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Botón colapsado / toggle ── */}
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '10px 14px', borderRadius: '12px', cursor: 'pointer',
          background: C.surface, border: `1px solid ${C.border2}`,
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          transition: 'border-color 0.15s',
          width: '100%',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = `rgba(56,182,255,0.35)`)}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.border2)}
      >
        {/* Icono */}
        <div style={{
          width: '26px', height: '26px', borderRadius: '7px', flexShrink: 0,
          background: `rgba(56,182,255,0.12)`, border: `1px solid rgba(56,182,255,0.25)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Map size={13} color={C.accent} />
        </div>

        {/* Texto + dots de progreso */}
        <div style={{ flex: 1, textAlign: 'left' }}>
          <p style={{ fontSize: '12px', fontWeight: 700, color: C.text, lineHeight: 1 }}>
            {t.guide_title}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '4px' }}>
            {STEPS.map((s) => (
              <div
                key={s.id}
                style={{
                  width: '16px', height: '3px', borderRadius: '2px',
                  background: completed.has(s.id) ? '#22c55e' : C.border2,
                  transition: 'background 0.3s',
                }}
              />
            ))}
            <span style={{ fontSize: '10px', color: C.text3, marginLeft: '4px' }}>
              {doneCount}/{totalCount}
            </span>
          </div>
        </div>

        {/* Chevron */}
        {expanded
          ? <ChevronDown size={14} color={C.text3} />
          : <ChevronUp   size={14} color={C.text3} />
        }
      </button>
    </div>
  );
}
