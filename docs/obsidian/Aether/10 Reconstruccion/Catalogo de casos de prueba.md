---
title: "Catálogo de casos de prueba"
tipo: "casos de prueba"
estado: "base inicial"
---

# Catálogo de casos de prueba

Cada caso debe completarse con datos, precondiciones, pasos, resultado, capa, automatización y evidencia al entrar en un sprint. La tabla establece el mínimo funcional y abusivo.

| ID | Escenario | Resultado esperado |
| :--- | :--- | :--- |
| CP-IAM-001 | Aceptar invitación vigente con identidad correcta | Crea membresía una vez, inicia sesión y audita |
| CP-IAM-002 | Reutilizar invitación o usar una expirada | Rechaza sin duplicar ni revelar datos sensibles |
| CP-IAM-003 | Revocar sesión desde otro dispositivo | La siguiente operación protegida falla y la interfaz vuelve a autenticación |
| CP-IAM-004 | Elevar privilegio sin autenticación reciente | Exige reautenticación y no ejecuta la acción |
| CP-IAM-005 | Suspender miembro con trabajos asignados | Revoca acceso, conserva autoría y advierte reasignaciones |
| CP-IAM-006 | Alterar rol desde el cliente | El servidor ignora el dato no autorizado y registra el intento pertinente |
| CP-TEN-001 | Consultar un recurso de otra organización por ID conocido | Deniega sin filtrar contenido |
| CP-TEN-002 | Cambiar organization_id en cuerpo de actualización | No mueve ni modifica el recurso |
| CP-TEN-003 | Suscribirse por WebSocket a canal ajeno | Rechaza la suscripción y no transmite eventos |
| CP-TEN-004 | Descargar una URL firmada después de perder acceso | Enlace expirado o control adicional impide acceso según diseño |
| CP-TEN-005 | Ejecutar trabajo encolado tras retiro de membresía | Revalida el permiso cuando la acción dependa de identidad vigente |
| CP-INI-001 | Guardar borrador parcial | Conserva versión sin iniciar evaluación |
| CP-INI-002 | Presentar sin resultado esperado | Rechaza con campo concreto y conserva el borrador |
| CP-INI-003 | Repetir presentación por timeout | Produce una transición y respuesta idempotente |
| CP-INI-004 | Detectar posible duplicado | Sugiere relación sin bloquear y registra decisión del usuario |
| CP-INI-005 | Retirar iniciativa durante evaluación | Aplica política, notifica y conserva historia |
| CP-EVA-001 | Publicar estándar y luego editarlo | Obliga a crear nueva versión |
| CP-EVA-002 | Completar evaluación con versión publicada | Conserva respuestas y versión exacta |
| CP-EVA-003 | Publicar evaluación incompleta | Rechaza indicando dimensiones pendientes |
| CP-EVA-004 | Evaluador declara conflicto | Impide publicación y activa reasignación |
| CP-EVA-005 | Cambia estándar mientras existe borrador | Mantiene o migra explícitamente, nunca mezcla criterios |
| CP-EVA-006 | Anular evaluación publicada | Conserva original, motivo y sustitución cuando exista |
| CP-DEC-001 | Aprobar con evidencia suficiente | Crea decisión inmutable y habilita formalización |
| CP-DEC-002 | Decidir sin rol o fuera del comité | Deniega y no cambia estado |
| CP-DEC-003 | Decisión condicionada pendiente | Impide conversión |
| CP-DEC-004 | Eximir condición con autoridad | Registra motivo y actor, luego habilita |
| CP-DEC-005 | Dos decisiones concurrentes | Solo una versión confirma y la otra recibe conflicto |
| CP-FOR-001 | Convertir iniciativa aprobada con roles confirmados | Crea proyecto, origen, roles y outbox atómicamente |
| CP-FOR-002 | Repetir la misma conversión | Devuelve el mismo proyecto |
| CP-FOR-003 | Usar misma clave con payload distinto | Rechaza conflicto de idempotencia |
| CP-FOR-004 | Fallar antes del commit | No quedan proyecto ni roles parciales |
| CP-FOR-005 | Fallar envío posterior al commit | Proyecto permanece y el worker reintenta |
| CP-FOR-006 | Intentar autoasignar al operador sin confirmación | Rechaza el rol implícito |
| CP-FOR-007 | Reanudar conversión interrumpida | Continúa desde estado seguro sin duplicar |
| CP-PRJ-001 | Activar sin líder o hito | Rechaza y enumera condiciones |
| CP-PRJ-002 | Actualizar tarea con versión antigua | Devuelve conflicto sin sobrescribir |
| CP-PRJ-003 | Completar hito con entregables pendientes | Aplica la regla acordada y explica pendientes |
| CP-PRJ-004 | Cambiar línea base sin aprobación | Conserva versión vigente |
| CP-PRJ-005 | Aprobar solicitud de cambio | Publica nueva línea base e historia |
| CP-PRJ-006 | Pausar y reactivar | Conserva fechas, motivo y replanificación requerida |
| CP-PRJ-007 | Cerrar con tareas abiertas | Exige resolver, trasladar o aceptar excepción |
| CP-PRJ-008 | Cerrar con evidencia completa | Registra resultados y bloquea edición directa histórica |
| CP-PRJ-009 | Calcular reporte con casos abiertos | Denominador y tratamiento aparecen documentados |
| CP-PRJ-010 | Miembro retirado intenta escribir | Deniega aunque conserve una página abierta |
| CP-DOC-001 | Subir archivo con extensión falsa | Detecta tipo real y pone en cuarentena |
| CP-DOC-002 | Subir archivo mayor al límite | Rechaza sin consumo no controlado |
| CP-DOC-003 | Escaneo marca malware | No publica, alerta y conserva evidencia mínima segura |
| CP-DOC-004 | Restaurar versión | Crea nueva cabeza sin borrar historia |
| CP-DOC-005 | Acceder a documento relacionado sin permiso padre | Deniega |
| CP-DOC-006 | Aplicar retención vencida | Elimina o bloquea conforme a política y registra resultado |
| CP-NOT-001 | Recibir el mismo evento dos veces | Una notificación lógica |
| CP-NOT-002 | Fallar proveedor de correo | Reintenta y conserva bandeja interna |
| CP-NOT-003 | Usuario pierde acceso antes de abrir | No muestra contenido protegido |
| CP-NOT-004 | Preferencia desactiva aviso no crítico | Respeta preferencia sin afectar avisos obligatorios |
| CP-AUD-001 | Consultar historia de una conversión | Orden, actores y correlación completos |
| CP-AUD-002 | Intentar modificar auditoría como administrador común | Deniega |
| CP-ACC-001 | Completar iniciativa solo con teclado | Todas las acciones son alcanzables y el foco es visible |
| CP-ACC-002 | Publicar evaluación con lector | Etiquetas, errores y progreso se anuncian |
| CP-ACC-003 | Usar zoom a 200 por ciento | No se pierde contenido ni acción |
| CP-ACC-004 | Preferir movimiento reducido | Se eliminan transiciones no esenciales |
| CP-ACC-005 | Interpretar estados sin color | Texto e iconografía aportan significado adicional |
| CP-SUP-001 | Acceso temporal aprobado | Expira y registra cada consulta |
| CP-SUP-002 | Restaurar respaldo | Cumple RTO, RPO e integridad |
| CP-SUP-003 | Outbox acumula mensajes | Alerta, recupera y no duplica efectos lógicos |
| CP-SUP-004 | Proveedor OIDC no disponible | Sesiones válidas siguen la política y nuevos accesos reciben estado claro |

## Relaciones

Las capas de automatización se definen en [[Estrategia de pruebas greenfield]]. Los IDs se conectan en [[Matriz de trazabilidad greenfield]].
