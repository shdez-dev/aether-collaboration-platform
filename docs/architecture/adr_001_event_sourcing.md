# ADR-001: Event Sourcing como Fundamento Arquitectónico

**Fecha**: 2025-01-02  
**Autor**: Juan Sebastián Hernández Rincón  
**Contexto**: Diseño arquitectónico inicial de AETHER

---

## Contexto y Problema

AETHER es una plataforma de colaboración en tiempo real donde múltiples usuarios pueden modificar simultáneamente el mismo estado compartido (tableros, tarjetas, documentos). Los desafíos principales son:

1. **Conflictos de concurrencia**: Múltiples usuarios editando la misma entidad simultáneamente
2. **Auditoría completa**: Necesidad de rastrear quién hizo qué y cuándo
3. **Recuperación ante fallos**: Capacidad de reconstruir estado en cualquier punto del tiempo
4. **Modo offline**: Usuarios deben poder trabajar sin conexión y sincronizar después
5. **Debugging temporal**: Reproducir bugs investigando el historial de eventos

Las arquitecturas tradicionales CRUD con bases de datos relacionales enfrentan limitaciones:

- Sobrescribir datos pierde información histórica
- Difícil implementar auditoría completa sin logging complejo
- Conflictos requieren estrategias de lock optimista complejas
- Sincronización offline-first es extremadamente difícil
- Debugging requiere logs externos y es incompleto

---

## Decisión

He adoptado Event Sourcing como patrón arquitectónico fundamental.

Todos los cambios de estado en AETHER se modelan como eventos inmutables almacenados en un Event Store. El estado actual es una proyección calculada reproduciendo eventos.

### Principios Core

1. **Los eventos son la fuente de verdad**: El Event Store es la única fuente de verdad
2. **Inmutabilidad**: Los eventos nunca se modifican, solo se agregan
3. **Append-only**: El Event Store solo acepta operaciones de escritura (append)
4. **Proyecciones**: El estado actual se deriva reproduciendo eventos
5. **Orden causal**: Vector clocks garantizan orden correcto de eventos

### Estructura de Eventos

```typescript
interface Event {
  eventId: EventId; // UUID v7 (time-ordered)
  type: string; // "card.moved", "board.created", etc.
  payload: unknown; // Event-specific data
  meta: {
    timestamp: number; // Unix ms
    userId: UserId; // Actor
    version: number; // Schema version
    vectorClock: VectorClock;
  };
}
```

---

## Consecuencias

### Positivas

**Auditoría Completa**

- Cada cambio queda registrado permanentemente
- Posible responder "quién cambió X y cuándo" con precisión absoluta
- Cumplimiento regulatorio simplificado

**Debugging Temporal**

- Reproducir bugs investigando secuencia de eventos
- Time-travel debugging: inspeccionar estado en cualquier momento
- Testing: replay de eventos para reproducir escenarios

**Modo Offline-First Natural**

- Cliente genera eventos localmente
- Sincronización es enviar eventos al servidor
- Conflictos se resuelven con estrategias CRDT

**Escalabilidad de Lectura**

- Proyecciones se pueden cachear agresivamente
- Múltiples proyecciones optimizadas para diferentes queries
- Event Store solo acepta appends (muy rápido)

**Evolución del Sistema**

- Nuevas features son nuevas proyecciones de eventos existentes
- Migración de datos es replay con nueva lógica
- A/B testing de lógica de negocio

**Arquitectura Distribuida**

- Eventos se pueden distribuir vía message queue (Redis Pub/Sub)
- Múltiples servicios pueden subscribirse a eventos
- Preparado para microservicios futuros

### Negativas

**Complejidad Conceptual**

- Paradigma mental diferente a CRUD tradicional
- Curva de aprendizaje para desarrolladores nuevos
- Requiere disciplina en diseño de eventos

**Eventual Consistency**

- Las proyecciones pueden estar levemente desactualizadas
- UI debe manejar optimistic updates
- Usuarios deben entender que algunos cambios tardan milisegundos en reflejarse

**Almacenamiento**

- Event Store crece monotónicamente
- Requiere estrategia de archivado (snapshots)
- Mayor uso de disco comparado con CRUD tradicional

**Complejidad de Queries**

- No todas las queries son eficientes contra Event Store
- Algunas queries requieren proyecciones especializadas
- Requiere planificación cuidadosa de proyecciones

### Mitigaciones

1. **Complejidad**: Documentación exhaustiva, ADRs, tipos TypeScript estrictos
2. **Consistency**: Optimistic UI con rollback en conflictos
3. **Storage**: Snapshots periódicos, archivado de eventos antiguos
4. **Queries**: Proyecciones denormalizadas en PostgreSQL, Redis cache

---

## Alternativas Consideradas

### 1. CRUD Tradicional con Auditoría

**Rechazado porque:**

- Auditoría es una reflexión posterior, no nativa
- Conflictos concurrentes requieren locks pesimistas o retry complejo
- Modo offline extremadamente difícil de implementar correctamente
- No hay replay ni time-travel debugging

### 2. Event Sourcing Parcial (Solo Auditoría)

**Rechazado porque:**

- Complejidad similar a Event Sourcing completo
- No aprovecha beneficios completos (replay, proyecciones múltiples)
- Confusión conceptual sobre qué es "fuente de verdad"

### 3. Operational Transformation (OT) Puro

**Rechazado porque:**

- Solo resuelve conflictos de edición de texto
- No generaliza bien a operaciones estructuradas (mover tarjetas)
- Más complejo que CRDT para el caso de uso de AETHER

---

## Implementación

### Stack Tecnológico

- **Event Store**: PostgreSQL con JSONB (índices en timestamp, eventId)
- **Proyecciones**: PostgreSQL (tablas denormalizadas)
- **Cache**: Redis para proyecciones frecuentes
- **Pub/Sub**: Redis para distribución de eventos
- **IDs**: UUID v7 (time-ordered, mejor performance en índices)

### Schema PostgreSQL

```sql
CREATE TABLE events (
  event_id UUID PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  user_id UUID NOT NULL,
  timestamp BIGINT NOT NULL,
  version INT NOT NULL,
  vector_clock JSONB NOT NULL
);

CREATE INDEX idx_events_timestamp ON events(timestamp);
CREATE INDEX idx_events_type ON events(event_type);
CREATE INDEX idx_events_user ON events(user_id);
```

### Proyección Ejemplo

```typescript
// Proyección de Card desde eventos
function projectCard(events: Event[]): Card {
  let card: Card | null = null;

  for (const event of events) {
    switch (event.type) {
      case 'card.created':
        card = { ...event.payload };
        break;
      case 'card.updated':
        card = { ...card, ...event.payload.changes };
        break;
      case 'card.moved':
        card.listId = event.payload.toListId;
        card.position = event.payload.toPosition;
        break;
    }
  }

  return card;
}
```

---

## Validación

Sabré que esta decisión fue correcta cuando:

1. Puedo responder cualquier pregunta de auditoría en menos de 1 segundo
2. Modo offline funciona sin pérdida de datos
3. Conflictos se resuelven automáticamente en más del 95% de casos
4. Debugging de producción requiere menos de 30 minutos con replay de eventos
5. Nuevas features no requieren migraciones de datos

---

## Referencias

- Event Sourcing - Martin Fowler (martinfowler.com/eaaDev/EventSourcing.html)
- CQRS Journey - Microsoft
- Event Sourcing You are doing it wrong - David Schmitz
- Designing Data-Intensive Applications - Martin Kleppmann

---

## Notas

Esta decisión establece la base arquitectónica de AETHER. Decisiones futuras sobre CRDT (ADR-005), WebSocket (ADR-002), y almacenamiento (ADR-003) se construyen sobre esta fundación.

El compromiso con Event Sourcing debe ser total: no puedo implementarlo "a medias". O todos los cambios son eventos, o ninguno lo es.
