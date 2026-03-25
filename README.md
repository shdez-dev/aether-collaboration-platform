# AETHER

Plataforma de colaboración en tiempo real para equipos distribuidos.

> **Estado**: En desarrollo activo

---

## Stack

**Frontend** — Next.js 14, TypeScript, Tailwind CSS, Socket.io, Zustand

**Backend** — Node.js + Express, PostgreSQL, Redis, Prisma, JWT

**Infra** — Docker, Turborepo

---

## Funcionalidades

- **Workspaces** — Espacios aislados por equipo con roles y presencia en tiempo real
- **Tableros Kanban** — Drag & drop con sincronización instantánea entre usuarios
- **Tarjetas** — Asignación, etiquetas, fechas, comentarios con @menciones y adjuntos
- **Documentos colaborativos** — Edición simultánea con cursores remotos y exportación a PDF/Markdown

---

## Arquitectura

Event-driven: cada acción se registra como evento inmutable y se propaga vía WebSocket a todos los clientes conectados.

```
Usuario → Acción → Evento → Event Store → WebSocket → Otros Usuarios
```

---

## Licencia

MIT — Ver archivo LICENSE.

---

**Sebastián Hernández** · [LinkedIn](https://www.linkedin.com/in/sebastian-hernandez-03284a229/)
