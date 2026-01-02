# AETHER

**Adaptive Event-driven Trusted Human-Environment for Real-time collaboration**

Plataforma de colaboración en tiempo real de grado producción construida sobre principios de event sourcing, permitiendo a equipos coordinar estado compartido a través de eventos distribuidos confiables en lugar de patrones tradicionales de sincronización.

---

## Visión General del Proyecto

AETHER es un sistema empresarial de colaboración que reimagina fundamentalmente cómo los equipos distribuidos interactúan con espacios de trabajo compartidos. En lugar de implementar mecanismos convencionales de sincronización de estado, la plataforma coordina intenciones humanas a través de un flujo de eventos inmutables, habilitando verdadera colaboración offline-first con resolución determinística de conflictos.

### Filosofía Core

Esta plataforma no es un clon de herramientas de colaboración existentes. Representa una exploración arquitectónica completa de sistemas event-driven aplicados a la colaboración humana:

- **Event Sourcing como Fundamento**: Cada cambio de estado se captura como un evento inmutable con seguimiento completo de causalidad
- **Coordinación de Estado Distribuido**: No hay fuente única de verdad - consistencia eventual convergente a través de eventos ordenados
- **Diseño Offline-First**: Operaciones locales primero con reconciliación automática tras reconexión
- **Patrones de UI Optimista**: Feedback inmediato al usuario con arbitraje del servidor y mecanismos de rollback
- **Resolución Inspirada en CRDT**: Resolución determinística de conflictos sin overhead de coordinación

---

## Arquitectura Técnica

### Principios de Diseño del Sistema

1. **Event Sourcing**: Auditoría completa con capacidad de replay de eventos
2. **Patrón CQRS**: Modelos de lectura y escritura separados para rendimiento óptimo
3. **Ordenamiento Causal**: Vector clocks aseguran secuenciación correcta de eventos entre clientes distribuidos
4. **Operaciones Idempotentes**: Replay seguro de eventos y semántica de retry de red
5. **Consistencia Eventual**: Estado convergente en todos los clientes sin operaciones bloqueantes

### Diagrama de Arquitectura

```
┌──────────────┐         ┌───────────────┐         ┌──────────────┐
│  Cliente A   │◄───WS──►│   Event Bus   │◄───WS──►│  Cliente B   │
│  (Browser)   │         │  (Socket.io)  │         │  (Browser)   │
└──────┬───────┘         └───────┬───────┘         └──────┬───────┘
       │                         │                         │
       │                    ┌────▼─────┐                   │
       │                    │  Event   │                   │
       └───────────────────►│  Store   │◄──────────────────┘
                            │(Postgres)│
                            └──────────┘
                                 │
                            ┌────▼─────┐
                            │  Redis   │
                            │ Pub/Sub  │
                            └──────────┘
```

---

## Stack Tecnológico

### Frontend
- **Framework**: Next.js 14 con App Router y React Server Components
- **Lenguaje**: TypeScript 5.3+ con verificación de tipos estricta
- **Gestión de Estado**: Zustand con Immer para actualizaciones inmutables
- **Tiempo Real**: Socket.io-client con reconexión automática
- **Estilos**: Tailwind CSS 3.x
- **Editor**: TipTap para edición colaborativa de texto enriquecido
- **Drag & Drop**: dnd-kit para interacciones accesibles

### Backend
- **Runtime**: Node.js 20 LTS
- **Framework**: Express.js con TypeScript
- **Tiempo Real**: Servidor Socket.io con adaptador Redis para escalado horizontal
- **Base de Datos**: PostgreSQL 15+ con JSONB para almacenamiento de eventos
- **Caché**: Redis 7 para pub/sub y gestión de sesiones
- **ORM**: Prisma para acceso type-safe a base de datos
- **Autenticación**: JWT con rotación de refresh tokens

### Infraestructura
- **Contenedorización**: Docker y Docker Compose
- **Monorepo**: Turborepo para pipeline de build optimizado
- **CI/CD**: GitHub Actions
- **Monitoreo**: Logging estructurado con IDs de correlación

---

## Estructura del Proyecto

```
aether/
├── apps/
│   ├── web/                    # Aplicación frontend Next.js
│   └── api/                    # Servicio backend Express
├── packages/
│   ├── @aether/types           # Definiciones TypeScript compartidas
│   ├── @aether/event-bus       # Implementación core del sistema de eventos
│   ├── @aether/ui              # Componentes React compartidos
│   └── @aether/crdt            # Tipos de datos replicados libres de conflictos
├── infrastructure/
│   ├── docker/                 # Configuraciones de contenedores
│   └── k8s/                    # Manifiestos Kubernetes (producción)
├── docs/
│   ├── architecture/           # Architecture Decision Records
│   ├── api/                    # Documentación de API
│   └── events/                 # Catálogo de eventos
└── scripts/                    # Scripts de build y deployment
```

---

## Funcionalidades Core

### Gestión de Workspaces
- Aislamiento multi-tenant de workspaces
- Control de acceso basado en roles (Owner, Admin, Member, Viewer)
- Indicadores de presencia de miembros en tiempo real
- Sistema de invitación con verificación de email

### Tableros de Proyectos
- Organización estilo Kanban
- Gestión de tarjetas con drag-and-drop con seguimiento de posición
- Actualizaciones en tiempo real entre todos los clientes conectados
- Plantillas de tableros para flujos de trabajo comunes

### Tarjetas de Tareas
- Descripciones de texto enriquecido con formato
- Asignación de miembros con notificaciones
- Categorización con etiquetas de colores personalizados
- Seguimiento de fechas de vencimiento con recordatorios
- Archivos adjuntos hasta 10MB
- Comentarios con hilos y menciones
- Historial completo de actividad

### Documentos Colaborativos
- Edición multi-usuario en tiempo real
- Presencia de cursores remotos
- Estructura de contenido basada en bloques
- Historial de versiones con visualización de diferencias
- Exportación a Markdown, PDF, HTML

### Sistema de Notificaciones
- Notificaciones WebSocket en tiempo real
- Notificaciones por email configurables
- Detección de menciones y alertas
- Feed de actividad con filtrado

### Búsqueda y Descubrimiento
- Búsqueda full-text en workspaces
- Filtrado avanzado por metadata
- Ranking de resultados de búsqueda

---

## Sistema de Eventos

### Estructura de Eventos

Todas las operaciones del sistema se modelan como eventos inmutables:

```typescript
interface Event<T = unknown> {
  eventId: string;           // UUID v7 para IDs ordenados por tiempo
  type: string;              // Tipo de evento con namespace (ej: "card.moved")
  payload: T;                // Datos específicos del evento
  meta: {
    timestamp: number;       // Timestamp Unix en milisegundos
    userId: string;          // Actor que disparó el evento
    version: number;         // Versión del esquema del evento
    vectorClock: VectorClock; // Metadata de ordenamiento causal
  };
}
```

### Categorías de Eventos

- **Eventos de Auth**: `user.registered`, `user.loggedIn`, `session.expired`
- **Eventos de Workspace**: `workspace.created`, `member.invited`, `member.roleChanged`
- **Eventos de Board**: `board.created`, `list.created`, `list.reordered`
- **Eventos de Card**: `card.created`, `card.moved`, `card.updated`, `card.deleted`
- **Eventos de Documento**: `document.created`, `document.updated`, `cursor.moved`
- **Eventos de Notificación**: `notification.created`, `notification.read`

---

## Estrategia de Testing

### Objetivos de Cobertura de Tests

- Lógica de Negocio: >80%
- Event Handlers: >90%
- Endpoints de API: >75%
- Componentes React: >60%

### Comandos de Test

```bash
# Ejecutar todos los tests
pnpm test

# Modo watch para desarrollo
pnpm test:watch

# Tests de integración
pnpm test:integration

# Tests end-to-end
pnpm test:e2e

# Reporte de cobertura
pnpm test:coverage
```

---

## Seguridad

### Autenticación y Autorización
- Hashing de contraseñas con Bcrypt (12 rounds)
- Tokens de acceso JWT (expiración 1 hora)
- Rotación de refresh tokens (expiración 7 días)
- Validación de permisos en cada operación

### Seguridad de Aplicación
- Sanitización de inputs para prevenir XSS
- Queries parametrizadas para prevenir SQL injection
- Rate limiting en endpoints de autenticación
- Configuración CORS con whitelist de orígenes
- Headers de seguridad vía Helmet.js
- Enforcement de HTTPS en producción

---

## Características de Performance

### Objetivos

- Carga inicial de página: <3 segundos
- Latencia de eventos en tiempo real: <100ms
- Tiempo de respuesta API (p95): <200ms
- Usuarios concurrentes por workspace: 100+
- Tarjetas máximas por workspace: 10,000+

### Estrategias de Optimización

- Caché Redis para queries frecuentes
- Indexación PostgreSQL en foreign keys y timestamps
- Connection pooling de WebSocket con sticky sessions
- Entrega de assets estáticos vía CDN
- Connection pooling de base de datos

---

## Deployment

### Ambiente de Desarrollo
- Docker Compose para desarrollo local
- Hot module reloading para iteración rápida
- Opción SQLite para setup simplificado

### Ambiente de Producción
- Orquestación Kubernetes
- Autoscaling horizontal de pods
- PostgreSQL con réplicas de lectura
- Redis Cluster para alta disponibilidad
- Object storage compatible con S3
- Distribución CDN CloudFront
- Backup automático a S3 (diario)

---

## Documentación

- **Arquitectura**: Catálogo completo de ADR en `/docs/architecture`
- **Referencia de API**: Especificación OpenAPI en `/docs/api`
- **Catálogo de Eventos**: Todos los eventos documentados en `/docs/events`
- **Guía de Deployment**: Setup de infraestructura en `/docs/deployment`

---

## Licencia

Software Propietario - Todos los derechos reservados

Copyright © 2025 Juan Sebastián Hernández Rincón. Todos los derechos reservados.

Este software y su documentación asociada son propiedad exclusiva del autor.
Cualquier uso, reproducción o distribución requiere autorización expresa por escrito.

Para consultas sobre licenciamiento comercial: juanhernandezr0075@gmail.com

---

**Construido con ingeniería arquitectónica de precisión**

*"La sincronización es una ilusión. Solo existen eventos en el tiempo."*
