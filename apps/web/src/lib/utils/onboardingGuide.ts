// lib/utils/onboardingGuide.ts
// Utilidad para manejar el estado del onboarding companion widget.
// Usa localStorage + custom events para sincronizar entre componentes.

export const GUIDE_LS_KEY        = 'aether_guide_v1';
export const GUIDE_DISMISSED_KEY = 'aether_guide_dismissed';

export const GUIDE_STEP_EVENT    = 'aether:guide:step';
export const GUIDE_DISMISS_EVENT = 'aether:guide:dismissed';
export const GUIDE_OPEN_EVENT    = 'aether:guide:open';

export const GUIDE_STEP_IDS = ['workspace', 'invite', 'project', 'board', 'card'] as const;
export type GuideStepId = typeof GUIDE_STEP_IDS[number];

export function getCompletedSteps(): Set<GuideStepId> {
  try {
    const raw = localStorage.getItem(GUIDE_LS_KEY);
    return new Set(raw ? (JSON.parse(raw) as GuideStepId[]) : []);
  } catch {
    return new Set();
  }
}

export function markStepDone(stepId: GuideStepId): void {
  try {
    const steps = getCompletedSteps();
    if (steps.has(stepId)) return; // ya estaba marcado
    steps.add(stepId);
    localStorage.setItem(GUIDE_LS_KEY, JSON.stringify([...steps]));
    window.dispatchEvent(new CustomEvent(GUIDE_STEP_EVENT, { detail: stepId }));
  } catch {}
}

export function isGuideDismissed(): boolean {
  try { return !!localStorage.getItem(GUIDE_DISMISSED_KEY); } catch { return false; }
}

export function dismissGuide(): void {
  try {
    localStorage.setItem(GUIDE_DISMISSED_KEY, '1');
    window.dispatchEvent(new CustomEvent(GUIDE_DISMISS_EVENT));
  } catch {}
}

export function openGuide(): void {
  try {
    localStorage.removeItem(GUIDE_DISMISSED_KEY);
    window.dispatchEvent(new CustomEvent(GUIDE_OPEN_EVENT));
  } catch {}
}
