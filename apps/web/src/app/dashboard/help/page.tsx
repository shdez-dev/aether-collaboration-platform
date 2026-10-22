"use client";

import { useRef, useState } from 'react';
import { Activity, Bell, BookOpen, Building2, CalendarDays, ChevronDown, CircleHelp, FileText, FolderKanban, LayoutGrid, ListTodo, Play, ShieldCheck, TriangleAlert, UsersRound, Workflow } from 'lucide-react';
import styles from './page.module.css';

const sections = [
  {
    id: 'primeros-pasos',
    title: 'Primeros pasos',
    description: 'Lo esencial para comenzar a trabajar en AETHER.',
    guides: [
      { id: 'espacios', title: 'Orientarse entre espacios', description: 'Encontrar tu espacio de trabajo y moverte entre contextos.', icon: LayoutGrid },
      { id: 'crear-proyecto', title: 'Crear un proyecto', description: 'Pasar de una idea a un proyecto compartido.', icon: FolderKanban },
      { id: 'recorrer-proyecto', title: 'Recorrer un proyecto', description: 'Conocer el resumen, los tableros, la planificación, los documentos y la actividad del proyecto.', icon: Workflow },
    ],
  },
  {
    id: 'organizar-trabajo',
    title: 'Organizar el trabajo',
    description: 'Planificación y seguimiento de las tareas del proyecto.',
    guides: [
      { id: 'tarjeta-tablero', title: 'Usar una tarjeta del tablero', description: 'Organizar una tarea, actualizar su estado y colaborar en ella.', icon: ListTodo },
      { id: 'backlog-sprints', title: 'Priorizar el backlog y planificar sprints', description: 'Ordenar el trabajo pendiente y preparar un sprint.', icon: Workflow },
      { id: 'cronograma', title: 'Organizar fechas e hitos', description: 'Usar el cronograma para coordinar fechas y entregas.', icon: CalendarDays },
      { id: 'riesgos', title: 'Registrar y dar seguimiento a riesgos', description: 'Identificar riesgos, valorar su impacto y mantenerlos al día.', icon: TriangleAlert },
    ],
  },
  {
    id: 'documentar-seguimiento',
    title: 'Documentar y dar seguimiento',
    description: 'Mantén la información del proyecto y sus novedades a mano.',
    guides: [
      { id: 'documentos', title: 'Crear y compartir documentos', description: 'Escribir, organizar y vincular documentos al trabajo.', icon: FileText },
      { id: 'calendario', title: 'Usar el calendario y los eventos', description: 'Consultar fechas y registrar momentos importantes.', icon: CalendarDays },
      { id: 'notificaciones-actividad', title: 'Consultar notificaciones y actividad', description: 'Encontrar novedades y revisar los cambios recientes.', icon: Bell },
    ],
  },
  {
    id: 'personas-configuracion',
    title: 'Personas y configuración',
    description: 'Administra quién participa y cómo se organiza el espacio.',
    guides: [
      { id: 'miembros', title: 'Invitar personas y administrar miembros', description: 'Sumar integrantes y asignar equipos al proyecto.', icon: UsersRound },
      { id: 'permisos', title: 'Entender roles y permisos', description: 'Conocer qué puede hacer cada rol en un espacio o proyecto.', icon: ShieldCheck },
      { id: 'equipos-espacios', title: 'Configurar equipos y espacios', description: 'Organizar los espacios de trabajo y sus equipos.', icon: Building2 },
    ],
  },
  {
    id: 'proyectos-completos',
    title: 'Proyectos completos',
    description: 'Funciones opcionales para proyectos que necesitan más detalle.',
    guides: [
      { id: 'trazabilidad', title: 'Trazabilidad avanzada', description: 'Seguir objetivos, entregables, decisiones y resultados cuando el proyecto la necesita.', icon: Activity },
    ],
  },
] as const;

const videoGuides = {
  espacios: {
    slug: 'orientarse-entre-espacios',
    duration: '36 s',
    durationLabel: '36 SEGUNDOS',
    details: 'Aprende a cambiar de espacio, comprobar tu contexto activo y volver a tu espacio personal.',
  },
  'crear-proyecto': {
    slug: 'crear-un-proyecto',
    duration: '46 s',
    durationLabel: '46 SEGUNDOS',
    details: 'Sigue los cuatro pasos para crear un proyecto en un espacio de equipo y elegir su enfoque.',
  },
  'recorrer-proyecto': {
    slug: 'recorrer-un-proyecto',
    duration: '50 s',
    durationLabel: '50 SEGUNDOS',
    details: 'Ubica el resumen, tableros, backlog, riesgos, documentos y actividad; conoce cuándo aparecen otras opciones.',
  },
  'tarjeta-tablero': {
    slug: 'usar-una-tarjeta-del-tablero',
    duration: '50 s',
    durationLabel: '50 SEGUNDOS',
    details: 'Abre una tarjeta, concreta la tarea, organiza sus pasos, colabora con el equipo y actualiza su estado.',
  },
} as const;

export default function HelpPage() {
  const [openVideoId, setOpenVideoId] = useState<string | null>(null);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});

  const toggleVideo = (id: string) => {
    if (openVideoId) videoRefs.current[openVideoId]?.pause();
    setOpenVideoId(openVideoId === id ? null : id);
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <span className={styles.eyebrow}><CircleHelp size={15} aria-hidden="true" /> CENTRO DE AYUDA</span>
          <h1>Guía de la plataforma</h1>
          <p>Recorridos breves para aprender cada parte de AETHER a tu ritmo.</p>
        </header>

        <nav className={styles.sectionNav} aria-label="Secciones de la guía">
          {sections.map((section) => <a key={section.id} href={`#${section.id}`}>{section.title}</a>)}
        </nav>

        <div className={styles.sections}>
          {sections.map((section) => (
            <section key={section.id} id={section.id} className={styles.section} aria-labelledby={`${section.id}-title`}>
              <div className={styles.sectionHeading}>
                <div>
                  <h2 id={`${section.id}-title`}>{section.title}</h2>
                  <p>{section.description}</p>
                </div>
                <span className={styles.sectionCount}>{section.guides.length} {section.guides.length === 1 ? 'recorrido' : 'recorridos'}</span>
              </div>
              <div className={styles.guideGrid}>
                {section.guides.map((guide) => {
                  const Icon = guide.icon;
                  if (guide.id === 'espacios' || guide.id === 'crear-proyecto' || guide.id === 'recorrer-proyecto' || guide.id === 'tarjeta-tablero') {
                    const video = videoGuides[guide.id];
                    const assetVersion = guide.id === 'tarjeta-tablero' ? '?v=50s' : '?v=rapido-1';
                    const isVideoOpen = openVideoId === guide.id;
                    return (
                      <article key={guide.id} id={guide.id} className={`${styles.guideCard} ${styles.videoGuide}`} data-open={isVideoOpen}>
                        <button type="button" className={styles.guideSummary} onClick={() => toggleVideo(guide.id)} aria-expanded={isVideoOpen} aria-controls={`tutorial-${guide.id}-panel`}>
                          <div className={styles.guideIcon} aria-hidden="true"><Icon size={19} strokeWidth={1.7} /></div>
                          <div className={styles.guideCopy}>
                            <h3>{guide.title}</h3>
                            <p>{guide.description}</p>
                          </div>
                          <span className={styles.videoAction}>
                            <Play className={styles.videoPlayIcon} size={15} fill="currentColor" aria-hidden="true" />
                            <span className={styles.videoOpenLabel}>Ver tutorial · {video.duration}</span>
                            <span className={styles.videoCloseLabel}>Cerrar tutorial</span>
                            <ChevronDown className={styles.videoChevron} size={15} aria-hidden="true" />
                          </span>
                        </button>
                        <div id={`tutorial-${guide.id}-panel`} className={styles.videoPanel} aria-hidden={!isVideoOpen}>
                          <div className={styles.videoPanelInner}>
                            <div className={styles.videoContent}>
                              <div className={styles.videoFrame}>
                                <video ref={(element) => { videoRefs.current[guide.id] = element; }} controls preload="none" playsInline tabIndex={isVideoOpen ? 0 : -1} poster={`/tutoriales/${video.slug}.png${assetVersion}`} aria-label={`Tutorial: ${guide.title}`}>
                                  <source src={`/tutoriales/${video.slug}.mp4${assetVersion}`} type="video/mp4" />
                                  <track kind="captions" src={`/tutoriales/${video.slug}.es.vtt${assetVersion}`} srcLang="es" label="Español" />
                                  Tu navegador no puede reproducir este video.
                                </video>
                              </div>
                              <div className={styles.videoDetails}>
                                <span className={styles.videoKicker}>RECORRIDO · {video.durationLabel}</span>
                                <p>{video.details}</p>
                                <span className={styles.captionNote}><FileText size={14} aria-hidden="true" /> Subtítulos en español disponibles</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  }
                  return (
                    <article key={guide.id} id={guide.id} className={styles.guideCard}>
                      <div className={styles.guideIcon} aria-hidden="true"><Icon size={19} strokeWidth={1.7} /></div>
                      <div className={styles.guideCopy}>
                        <h3>{guide.title}</h3>
                        <p>{guide.description}</p>
                      </div>
                      <span className={styles.guideStatus}><BookOpen size={13} aria-hidden="true" /> En preparación</span>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
