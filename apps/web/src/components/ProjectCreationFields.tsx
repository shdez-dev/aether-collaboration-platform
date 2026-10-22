'use client';

import type { CSSProperties } from 'react';
import styles from './ProjectCreationFields.module.css';

export interface ProjectCreationAnswers {
  title: string;
  context: string;
  objective: string;
  successMetric: string;
  targetValue: string;
  unit: string;
}

export const EMPTY_PROJECT_CREATION_ANSWERS: ProjectCreationAnswers = {
  title: '',
  context: '',
  objective: '',
  successMetric: '',
  targetValue: '',
  unit: '',
};

export function ProjectCreationFields({
  step,
  values,
  onChange,
  accent = '#7452A6',
}: {
  step: 0 | 1;
  values: ProjectCreationAnswers;
  onChange: (key: keyof ProjectCreationAnswers, value: string) => void;
  accent?: string;
}) {
  return (
    <div className={styles.fields} style={{ '--project-field-accent': accent } as CSSProperties}>
      {step === 0 ? (
        <>
          <label htmlFor="project-creation-title" className={styles.field}>
            <span className={styles.label}>Nombre del proyecto <span className={styles.required} aria-hidden="true">*</span></span>
            <small className={styles.hint}>Un nombre breve y fácil de reconocer para el equipo.</small>
            <input
              id="project-creation-title"
              name="projectName"
              type="text"
              required
              minLength={3}
              maxLength={120}
              value={values.title}
              onChange={(event) => onChange('title', event.target.value)}
              placeholder="Ej. Mejorar la atención de clientes"
              className={styles.control}
              autoComplete="off"
            />
            <small className={styles.counter}>{values.title.length}/120</small>
          </label>

          <label htmlFor="project-creation-context" className={styles.field}>
            <span className={styles.label}>Contexto o necesidad <span className={styles.optional}>Opcional</span></span>
            <small className={styles.hint}>¿Qué situación u oportunidad da origen al proyecto?</small>
            <textarea
              id="project-creation-context"
              name="projectContext"
              maxLength={1000}
              rows={3}
              value={values.context}
              onChange={(event) => onChange('context', event.target.value)}
              placeholder="Describe brevemente el punto de partida. Puedes completarlo más adelante."
              className={`${styles.control} ${styles.textarea}`}
            />
            <small className={styles.counter}>{values.context.length}/1000</small>
          </label>
        </>
      ) : (
        <>
          <label htmlFor="project-creation-objective" className={styles.field}>
            <span className={styles.label}>Objetivo del proyecto <span className={styles.required} aria-hidden="true">*</span></span>
            <small className={styles.hint}>Define el resultado concreto que debería lograr el proyecto.</small>
            <textarea
              id="project-creation-objective"
              name="projectObjective"
              required
              minLength={2}
              maxLength={1000}
              rows={3}
              value={values.objective}
              onChange={(event) => onChange('objective', event.target.value)}
              placeholder="Ej. Reducir el tiempo de respuesta a las solicitudes de clientes."
              className={`${styles.control} ${styles.textarea}`}
            />
            <small className={styles.counter}>{values.objective.length}/1000</small>
          </label>

          <fieldset className={styles.metricGroup}>
            <legend className={styles.metricTitle}>Indicador de éxito <span className={styles.optional}>Opcional</span></legend>
            <p className={styles.hint}>Añádelo si ya sabes cómo comprobar el resultado esperado.</p>
            <div className={styles.metricFields}>
              <label htmlFor="project-success-metric" className={styles.field}>
                <span className={styles.label}>Indicador</span>
                <input
                  id="project-success-metric"
                  name="successMetric"
                  type="text"
                  maxLength={160}
                  value={values.successMetric}
                  onChange={(event) => onChange('successMetric', event.target.value)}
                  placeholder="Ej. Tiempo de respuesta"
                  className={styles.control}
                />
              </label>
              <label htmlFor="project-success-target" className={styles.field}>
                <span className={styles.label}>Meta</span>
                <input
                  id="project-success-target"
                  name="successTarget"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={9999999999.99}
                  step="any"
                  value={values.targetValue}
                  onChange={(event) => onChange('targetValue', event.target.value)}
                  placeholder="Ej. 5"
                  className={styles.control}
                />
              </label>
              <label htmlFor="project-success-unit" className={styles.field}>
                <span className={styles.label}>Unidad</span>
                <input
                  id="project-success-unit"
                  name="successUnit"
                  type="text"
                  maxLength={40}
                  value={values.unit}
                  onChange={(event) => onChange('unit', event.target.value)}
                  placeholder="Ej. segundos"
                  className={styles.control}
                />
              </label>
            </div>
          </fieldset>
        </>
      )}
    </div>
  );
}
