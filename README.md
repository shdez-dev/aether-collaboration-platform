# AETHER

**Plataforma de colaboración en tiempo real para equipos distribuidos**

Sistema de gestión de proyectos y documentos colaborativos con sincronización en tiempo real, arquitectura basada en eventos.

> **Estado**: Proyecto en desarrollo activo

---

## Descripción del Proyecto

AETHER es una plataforma de colaboración diseñada para equipos que necesitan trabajar de forma sincronizada en proyectos compartidos. Similar a herramientas como Trello o Notion, pero construida con una arquitectura moderna basada en eventos que permite:

- **Colaboración en tiempo real**: Múltiples usuarios editando simultáneamente
- **Historial completo**: Cada cambio queda registrado y es auditable
- **Escalabilidad**: Arquitectura preparada para manejar miles de usuarios

---

## Stack Tecnológico

**Frontend**
- Next.js 14 - Framework React con Server Components
- TypeScript - Tipado estático para mayor robustez
- Tailwind CSS - Estilos modernos y responsivos
- Socket.io - Comunicación en tiempo real
- Zustand - Gestión de estado del cliente

**Backend**
- Node.js + Express - API REST y WebSocket server
- PostgreSQL - Base de datos principal
- Redis - Caché y pub/sub para tiempo real
- Prisma - ORM type-safe
- JWT - Autenticación segura

**Infraestructura**
- Docker - Contenedorización
- Turborepo - Monorepo management

---

## Funcionalidades Principales

**Workspaces**
- Espacios de trabajo aislados por equipo
- Roles de usuario (Owner, Admin, Member, Viewer)
- Invitaciones por email
- Indicadores de presencia en tiempo real

**Tableros Kanban**
- Organización visual de tareas
- Drag & drop entre columnas
- Sincronización instantánea entre usuarios
- Plantillas predefinidas

**Tarjetas de Tareas**
- Descripciones con texto enriquecido
- Asignación de miembros
- Etiquetas personalizables
- Fechas de vencimiento
- Comentarios y menciones
- Archivos adjuntos

**Documentos Colaborativos**
- Edición simultánea de múltiples usuarios
- Cursores remotos visibles
- Historial de versiones
- Exportación a Markdown/PDF

---

## Arquitectura Técnica

El proyecto implementa una arquitectura **event-driven** donde cada acción del usuario se registra como un evento inmutable. Esto permite:

- **Auditoría completa**: Saber quién hizo qué y cuándo
- **Sincronización confiable**: Los eventos se ordenan correctamente entre clientes
- **Resolución de conflictos**: Sistema determinístico para manejar ediciones simultáneas
- **Replay de estado**: Reconstruir el estado de la aplicación desde los eventos

**Flujo de eventos**

```
Usuario → Acción → Evento → Event Store → Notificación → Otros Usuarios
```

Todos los clientes conectados reciben los eventos en tiempo real vía WebSocket.

---

## Seguridad

- Autenticación JWT con refresh tokens
- Hashing de contraseñas con Bcrypt
- Rate limiting en endpoints críticos
- Sanitización de inputs (XSS prevention)
- CORS configurado
- HTTPS en producción

---

## Licencia

MIT License - Ver archivo LICENSE para más detalles.

---

## Autor

**Sebastián Hernández**

LinkedIn: (https://www.linkedin.com/in/sebastian-hernandez-03284a229/)  
