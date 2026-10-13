'use client';

import type { CSSProperties } from 'react';
import styles from './ProjectProposalFields.module.css';

export type ProposalStep = 0 | 1 | 2;

export interface ProjectProposalAnswers {
  title: string;
  summary: string;
  problemStatement: string;
  impactedPeople: string;
  problemImpact: string;
  impactedCount: string;
  expectedOutcome: string;
  proposedSolution: string;
  differentiation: string;
}

export const EMPTY_PROJECT_PROPOSAL: ProjectProposalAnswers = {
  title: '',
  summary: '',
  problemStatement: '',
  impactedPeople: '',
  problemImpact: '',
  impactedCount: '',
  expectedOutcome: '',
  proposedSolution: '',
  differentiation: '',
};

export const PROPOSAL_STEPS = [
  { title: 'Contexto', description: 'Define qué quieres mejorar y cuál es la necesidad.' },
  { title: 'Impacto', description: 'Identifica a quién afecta y qué consecuencias tiene.' },
  { title: 'Propuesta', description: 'Explica el cambio esperado y la solución.' },
] as const;

type ProposalKey = keyof ProjectProposalAnswers;
type ProposalField = { key: ProposalKey; label: string; hint: string; placeholder: string; type?: 'text' | 'number'; wide?: boolean };

const fieldsByStep: Record<ProposalStep, ProposalField[]> = {
  0: [
    { key: 'title', label: 'Nombre de la iniciativa', hint: 'Un nombre breve y fácil de reconocer.', placeholder: 'Ej. Mejorar la atención de clientes', type: 'text' },
    { key: 'summary', label: 'Resumen de la iniciativa', hint: 'En pocas líneas, explica qué oportunidad estás explorando.', placeholder: 'Resume la oportunidad o idea que quieres impulsar.' },
    { key: 'problemStatement', label: 'Problemática identificada', hint: 'Describe la necesidad y la situación actual, no la solución.', placeholder: '¿Qué está ocurriendo y por qué hace falta mejorarlo?' },
  ],
  1: [
    { key: 'impactedPeople', label: 'Personas impactadas', hint: 'Describe los grupos o perfiles afectados.', placeholder: '¿A quién afecta esta situación?' },
    { key: 'problemImpact', label: 'Impacto de la problemática', hint: 'Explica sus consecuencias para las personas o la organización.', placeholder: '¿Qué consecuencias genera hoy?' },
    { key: 'impactedCount', label: 'Cantidad aproximada de personas', hint: 'Usa una estimación si todavía no tienes una cifra exacta.', placeholder: 'Ej. 25', type: 'number' },
  ],
  2: [
    { key: 'expectedOutcome', label: 'Propuesta de valor', hint: '¿Qué cambio esperas lograr y cómo podrías medirlo?', placeholder: 'Ej. Reducir los tiempos de respuesta en un 20%.' },
    { key: 'proposedSolution', label: 'Solución propuesta', hint: 'Describe en qué consiste la solución que estás planteando.', placeholder: '¿Qué propones hacer para resolver la problemática?' },
    { key: 'differentiation', label: '¿Qué la hace diferente?', hint: 'Explica qué aporta frente a las alternativas actuales.', placeholder: '¿Por qué esta propuesta es distinta o mejor?' },
  ],
};

export function ProjectProposalFields({
  step,
  values,
  onChange,
  accent = '#7452A6',
}: {
  step: ProposalStep;
  values: ProjectProposalAnswers;
  onChange: (key: ProposalKey, value: string) => void;
  accent?: string;
}) {
  return (
    <div className={styles.fields} style={{ '--project-field-accent': accent } as CSSProperties}>
      {fieldsByStep[step].map((field) => {
        const fieldId = `proposal-${field.key}`;
        return (
          <label key={field.key} htmlFor={fieldId} className={styles.field}>
            <span className={styles.label}>
              {field.label} <span style={{ color: accent }}>*</span>
            </span>
            <small className={styles.hint}>{field.hint}</small>
            {field.type === 'number' ? (
              <input
                id={fieldId}
                type="number"
                inputMode="numeric"
                min={1}
                max={1_000_000_000}
                step={1}
                required
                value={values[field.key]}
                onChange={(event) => onChange(field.key, event.target.value)}
                placeholder={field.placeholder}
                className={styles.control}
              />
            ) : field.key === 'title' ? (
              <input
                id={fieldId}
                type="text"
                required
                minLength={3}
                maxLength={120}
                value={values[field.key]}
                onChange={(event) => onChange(field.key, event.target.value)}
                placeholder={field.placeholder}
                className={styles.control}
              />
            ) : (
              <textarea
                id={fieldId}
                required
                minLength={2}
                maxLength={field.key === 'summary' ? 1000 : 8000}
                rows={field.key === 'summary' ? 3 : 4}
                value={values[field.key]}
                onChange={(event) => onChange(field.key, event.target.value)}
                placeholder={field.placeholder}
                className={`${styles.control} ${styles.textarea}`}
              />
            )}
            {field.type !== 'number' && <small className={styles.counter}>{values[field.key].length}/{field.key === 'title' ? 120 : field.key === 'summary' ? 1000 : 8000}</small>}
          </label>
        );
      })}
    </div>
  );
}
