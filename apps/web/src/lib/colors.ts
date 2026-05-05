/**
 * Theme-aware color tokens.
 * Uses CSS custom properties so the values adapt automatically to
 * the active theme (.light / dark-default) via globals.css.
 */
export const C = {
  bg:      'var(--c-bg)',
  bg2:     'var(--c-bg2)',
  surface: 'var(--c-surface)',
  hover:   'var(--c-hover)',
  border:  'var(--c-border)',
  border2: 'var(--c-border2)',
  text:    'var(--c-text)',
  text2:   'var(--c-text2)',
  text3:   'var(--c-text3)',
  text4:   'var(--c-text4)',
  accent:  'var(--c-accent)',
  green:   'var(--c-green)',
  amber:   'var(--c-amber)',
  red:     'var(--c-red)',
} as const;
