'use client';

import type { CSSProperties } from 'react';
import styles from './ProjectCreationFields.module.css';

export interface ProjectCreationAnswers {
  title: string;
  context: string;
  impactedPeople: string;
  problemImpact: string;
  objective: string;
  expectedDeliverables: string;
  scopeInclusions: string;
  scopeExclusions: string;
  endDate: string;
  projectConstraints: string;
}

export type ProjectCreationFieldErrors = Partial<Record<'title' | 'context' | 'objective', string>>;

export const EMPTY_PROJECT_CREATION_ANSWERS: ProjectCreationAnswers = {
  title: '',
  context: '',
  impactedPeople: '',
  problemImpact: '',
  objective: '',
  expectedDeliverables: '',
  scopeInclusions: '',
  scopeExclusions: '',
  endDate: '',
  projectConstraints: '',
};

function TextAreaField({
  id,
  name,
  label,
  hint,
  placeholder,
  value,
  onChange,
  required = false,
  error,
  maxLength = 1000,
}: {
  id: string;
  name: string;
  label: string;
  hint?: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  error?: string;
  maxLength?: number;
}) {
  return (
    <label htmlFor={id} className={styles.field}>
      <span className={styles.label}>{label} {required ? <span className={styles.required} aria-hidden="true">*</span> : <span className={styles.optional}>Opcional</span>}</span>
      {hint && <small id={`${id}-hint`} className={styles.hint}>{hint}</small>}
      <textarea
        id={id}
        name={name}
        aria-required={required || undefined}
        aria-invalid={Boolean(error)}
        aria-describedby={[hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined}
        maxLength={maxLength}
        rows={3}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={`${styles.control} ${styles.textarea} ${error ? styles.invalid : ''}`}
      />
      {error && <small id={`${id}-error`} className={styles.fieldError} role="alert">{error}</small>}
      <small className={styles.counter}>{value.length}/{maxLength}</small>
    </label>
  );
}

export function ProjectCreationFields({
  step,
  values,
  errors = {},
  onChange,
  accent = '#7452A6',
}: {
  step: 0 | 1 | 2;
  values: ProjectCreationAnswers;
  errors?: ProjectCreationFieldErrors;
  onChange: (key: keyof ProjectCreationAnswers, value: string) => void;
  accent?: string;
}) {
  return (
    <div className={styles.fields} style={{ '--project-field-accent': accent } as CSSProperties}>
      {step === 0 ? (
        <>
          <label htmlFor="project-creation-title" className={styles.field}>
            <span className={styles.label}>Nombre del proyecto <span className={styles.required} aria-hidden="true">*</span></span>
            <small id="project-creation-title-hint" className={styles.hint}>Un nombre breve y fácil de reconocer para el equipo.</small>
            <input
              id="project-creation-title"
              name="projectName"
              type="text"
              aria-required="true"
              aria-invalid={Boolean(errors.title)}
              aria-describedby={errors.title ? 'project-creation-title-hint project-creation-title-error' : 'project-creation-title-hint'}
              maxLength={120}
              value={values.title}
              onChange={(event) => onChange('title', event.target.value)}
              placeholder="Ej. Portal de atención al cliente"
              className={`${styles.control} ${errors.title ? styles.invalid : ''}`}
              autoComplete="off"
            />
            {errors.title && <small id="project-creation-title-error" className={styles.fieldError} role="alert">{errors.title}</small>}
            <small className={styles.counter}>{values.title.length}/120</small>
          </label>

          <TextAreaField
            id="project-creation-context"
            name="projectContext"
            label="Problema u oportunidad"
            hint="¿Qué situación concreta da origen al proyecto? Describe el punto de partida, sin adelantar la solución."
            placeholder="Ej. Las solicitudes llegan por correo y planillas distintas, así que el equipo pierde el seguimiento y duplica respuestas."
            value={values.context}
            onChange={(value) => onChange('context', value)}
            required
            error={errors.context}
          />

          <div className={styles.pairedFields}>
            <TextAreaField
              id="project-creation-impacted-people"
              name="impactedPeople"
              label="¿A quién afecta?"
              hint="Personas, equipos o usuarios afectados."
              placeholder="Ej. Equipo de soporte y clientes que solicitan ayuda."
              value={values.impactedPeople}
              onChange={(value) => onChange('impactedPeople', value)}
            />
            <TextAreaField
              id="project-creation-problem-impact"
              name="problemImpact"
              label="Impacto y urgencia"
              hint="¿Qué ocurre hoy si no se resuelve? ¿Por qué importa ahora?"
              placeholder="Ej. Las respuestas tardan varios días y el volumen de solicitudes sigue creciendo."
              value={values.problemImpact}
              onChange={(value) => onChange('problemImpact', value)}
            />
          </div>
        </>
      ) : step === 1 ? (
        <>
          <TextAreaField
            id="project-creation-objective"
            name="projectObjective"
            label="Objetivo del proyecto"
            hint="¿Qué cambio concreto debería existir cuando el proyecto termine?"
            placeholder="Ej. Centralizar las solicitudes para que clientes y soporte puedan consultar su estado en un solo lugar."
            value={values.objective}
            onChange={(value) => onChange('objective', value)}
            required
            error={errors.objective}
          />

          <TextAreaField
            id="project-creation-deliverables"
            name="expectedDeliverables"
            label="Resultados o entregables esperados"
            hint="Productos, capacidades o cambios concretos que debería dejar el proyecto."
            placeholder="Ej. Un portal web, una bandeja para el equipo de soporte y una guía breve para usuarios."
            value={values.expectedDeliverables}
            onChange={(value) => onChange('expectedDeliverables', value)}
          />

          <div className={styles.pairedFields}>
            <TextAreaField
              id="project-creation-scope-in"
              name="scopeInclusions"
              label="Qué incluye"
              hint="Funciones, áreas o personas que sí forman parte."
              placeholder="Ej. Registro, asignación y consulta del estado de solicitudes."
              value={values.scopeInclusions}
              onChange={(value) => onChange('scopeInclusions', value)}
            />
            <TextAreaField
              id="project-creation-scope-out"
              name="scopeExclusions"
              label="Qué queda fuera"
              hint="Límites que conviene dejar claros desde el inicio."
              placeholder="Ej. Atención telefónica e integración con WhatsApp en esta etapa."
              value={values.scopeExclusions}
              onChange={(value) => onChange('scopeExclusions', value)}
            />
          </div>
        </>
      ) : (
        <>
          <div className={styles.field}>
            <label htmlFor="project-creation-end-date" className={styles.label}>Fecha límite o hito importante <span className={styles.optional}>Opcional</span></label>
            <small id="project-creation-end-date-hint" className={styles.hint}>Indícala solo si ya existe una fecha que el proyecto deba considerar.</small>
            <input
              id="project-creation-end-date"
              name="projectEndDate"
              type="date"
              aria-describedby="project-creation-end-date-hint"
              value={values.endDate}
              onChange={(event) => onChange('endDate', event.target.value)}
              className={styles.control}
            />
          </div>

          <TextAreaField
            id="project-creation-constraints"
            name="projectConstraints"
            label="Restricciones o condiciones"
            hint="Por ejemplo, límites de presupuesto, herramientas disponibles, normas o dependencias."
            placeholder="Ej. Debe funcionar con el sistema actual y estar disponible en español; no hay presupuesto para licencias nuevas."
            value={values.projectConstraints}
            onChange={(value) => onChange('projectConstraints', value)}
          />
        </>
      )}
    </div>
  );
}
