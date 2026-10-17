'use client';

import { type FormEvent, useEffect, useState } from 'react';
import { Bug, Check, Lightbulb, MessageSquareText, Send } from 'lucide-react';
import { apiService } from '@/services/apiService';
import styles from './page.module.css';

type FeedbackType = 'FEEDBACK' | 'BUG';

export default function FeedbackPage() {
  const [sourcePath, setSourcePath] = useState('/dashboard/feedback');
  const [type, setType] = useState<FeedbackType>('FEEDBACK');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [reproductionSteps, setReproductionSteps] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sentId, setSentId] = useState<string | null>(null);

  useEffect(() => {
    const from = new URLSearchParams(window.location.search).get('from');
    if (from && (from === '/dashboard' || from.startsWith('/dashboard/')) && from.length <= 500) {
      setSourcePath(from);
    }
  }, []);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setReproductionSteps('');
    setError('');
    setSentId(null);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (sending) return;
    setSending(true);
    setError('');
    try {
      const response = await apiService.post<{ id: string; createdAt: string }>('/api/feedback', {
        type,
        title: title.trim(),
        description: description.trim(),
        reproductionSteps: reproductionSteps.trim(),
        pagePath: sourcePath,
      }, true);
      if (!response.success || !response.data) {
        setError(response.error?.message ?? 'No se pudo enviar el comentario. Inténtalo de nuevo.');
        return;
      }
      setSentId(response.data.id);
    } catch {
      setError('No se pudo conectar con el servidor. Tu texto sigue aquí para que puedas volver a intentarlo.');
    } finally {
      setSending(false);
    }
  };

  return <main className={styles.page}>
    <div className={styles.content}>
      <header className={styles.intro}>
        <div className={styles.introIcon}><MessageSquareText size={21} aria-hidden="true" /></div>
        <div><span className={styles.eyebrow}>AYÚDANOS A MEJORAR AETHER</span><h1>Feedback y reportes</h1><p>Cuéntanos qué te gustaría mejorar o qué dejó de funcionar. El equipo de Aether recibirá tu mensaje.</p></div>
      </header>

      {sentId ? <section className={styles.successPanel} role="status" aria-live="polite">
        <span className={styles.successIcon}><Check size={22} aria-hidden="true" /></span>
        <span className={styles.eyebrow}>RECIBIDO POR EL EQUIPO</span>
        <h2>Gracias por contárnoslo</h2>
        <p>Guardamos tu {type === 'BUG' ? 'reporte de bug' : 'comentario'} en Administración. Puedes seguir trabajando; el envío quedó registrado.</p>
        <span className={styles.reference}>Referencia · {sentId.slice(-8).toUpperCase()}</span>
        <button type="button" className={styles.secondaryButton} onClick={resetForm}>Enviar otro comentario</button>
      </section> : <form className={styles.form} onSubmit={submit}>
        <div className={styles.formHeader}><div><h2>¿Qué quieres compartir?</h2><p>Elige una opción y agrega el contexto necesario.</p></div><span className={styles.privateNote}>Solo lo verá el equipo de Aether</span></div>

        <div className={styles.typeChoices} role="group" aria-label="Tipo de comentario">
          <button type="button" className={`${styles.typeChoice} ${type === 'FEEDBACK' ? styles.typeChoiceActive : ''}`} onClick={() => setType('FEEDBACK')} aria-pressed={type === 'FEEDBACK'}>
            <span className={styles.typeIcon}><Lightbulb size={17} aria-hidden="true" /></span><span><strong>Idea o comentario</strong><small>Una mejora, sugerencia o algo que te gustó.</small></span>{type === 'FEEDBACK' && <Check className={styles.choiceCheck} size={16} aria-hidden="true" />}
          </button>
          <button type="button" className={`${styles.typeChoice} ${type === 'BUG' ? styles.typeChoiceActive : ''}`} onClick={() => setType('BUG')} aria-pressed={type === 'BUG'}>
            <span className={styles.typeIcon}><Bug size={17} aria-hidden="true" /></span><span><strong>Reportar un bug</strong><small>Algo no funciona como debería.</small></span>{type === 'BUG' && <Check className={styles.choiceCheck} size={16} aria-hidden="true" />}
          </button>
        </div>

        <label className={styles.field}>Título<input value={title} onChange={(event) => setTitle(event.target.value)} required minLength={4} maxLength={120} placeholder={type === 'BUG' ? 'Ej. No puedo guardar un evento' : 'Ej. Filtro por responsable en proyectos'} /></label>
        <label className={styles.field}>{type === 'BUG' ? '¿Qué ocurrió?' : 'Cuéntanos más'}<textarea value={description} onChange={(event) => setDescription(event.target.value)} required minLength={10} maxLength={4000} rows={5} placeholder={type === 'BUG' ? 'Describe qué esperabas que ocurriera y qué pasó en su lugar.' : '¿Cómo te ayudaría esta mejora? Comparte cualquier detalle que nos sirva.'} /><small className={styles.fieldHint}>{description.length}/4000</small></label>
        {type === 'BUG' && <label className={styles.field}>Pasos para reproducir <span className={styles.optional}>Opcional</span><textarea value={reproductionSteps} onChange={(event) => setReproductionSteps(event.target.value)} maxLength={4000} rows={3} placeholder={'1. Abre…\n2. Selecciona…\n3. El problema aparece…'} /><small className={styles.fieldHint}>La pantalla actual se adjunta automáticamente como contexto.</small></label>}
        <p className={styles.contextHint}>Incluiremos la pantalla desde donde abriste este formulario para dar contexto al equipo.</p>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <footer className={styles.actions}><span>Tu comentario se enviará de forma privada al equipo.</span><button type="submit" className={styles.submitButton} disabled={sending || title.trim().length < 4 || description.trim().length < 10}><Send size={15} aria-hidden="true" />{sending ? 'Enviando…' : type === 'BUG' ? 'Enviar reporte' : 'Enviar comentario'}</button></footer>
      </form>}
    </div>
  </main>;
}
