---
title: "Seguridad y datos"
tipo: "diseño propuesto"
fecha_revision: 2026-09-07
version_documental: "1.0"
---

# Seguridad y datos

## Objetivo

Asegurar que cada persona accede al contexto autorizado y que las operaciones dejan evidencia suficiente. Esta nota especifica controles de producto y pruebas; no constituye certificación de seguridad ni interpretación legal.

## Clasificación propuesta

| Clase | Ejemplos | Tratamiento |
| :--- | :--- | :--- |
| Pública | Descripción publicada de un programa | Publicación explícita |
| Interna | Políticas y acuerdos de workspace | Membresía autorizada |
| Restringida | Evaluaciones, expedientes y evidencia privada | Acceso por recurso y propósito |
| Secreta | Tokens, credenciales y claves | Sólo componentes autorizados del servidor |

El recurso hereda una clasificación por defecto y puede restringirse según política. Publicar una iniciativa o un resultado es una acción explícita sobre una versión determinada.

## Identidad y sesiones

El código contiene JWT, refresh tokens, sesiones y verificación de correo. El frontend persiste accessToken y refreshToken en localStorage. Esto establece exposición ante ejecución de JavaScript no autorizado y merece una decisión de arquitectura.

Se propone evaluar sesiones con cookies HttpOnly, Secure y política SameSite adecuada al despliegue, junto con protección CSRF si se adoptan cookies para autenticar mutaciones. La migración necesita verificar CORS, dominios y funcionamiento móvil; cambiar almacenamiento sin analizar estos contratos no resuelve el problema completo.

## Amenazas prioritarias

| Amenaza | Control | Prueba |
| :--- | :--- | :--- |
| Acceso por identificador ajeno | Autorización por recurso | Sustituir IDs entre organizaciones |
| Filtración en búsqueda o métricas | Consultas filtradas antes de agregar | Usuario con acceso parcial |
| Concesión externa vencida | Validación de vigencia | Sesión abierta durante expiración |
| Archivo malicioso | Límites, tipo y procesamiento aislado | Archivo manipulado y sobredimensionado |
| URL peligrosa en exportación | Política de destinos y red | Recurso interno solicitado por documento |
| Doble aprobación concurrente | Versión y transacción | Dos decisiones simultáneas |
| Webhook falsificado o repetido | Firma e idempotencia | Firma inválida y reenvío |
| Fuga por notificación | Minimización y autorización | Acceso revocado antes de leer |
| Secreto en logs | Redacción y reglas de registro | Inspección de errores y trazas |

## Ciclo de vida de datos

Definir creación, edición, clasificación, exportación, archivo, conservación y eliminación. Una solicitud de eliminación debe identificar datos propios, contribuciones compartidas y obligaciones de conservación del cliente. Los historiales pueden conservar identificadores seudonimizados cuando la política lo requiera.

Las copias de seguridad también requieren política de acceso y expiración. Restaurar una copia no debe reactivar accesos revocados sin reconciliación.

## Administración y soporte

No debe existir acceso ilimitado de soporte por defecto. Una intervención requiere ámbito, motivo, duración y auditoría. Las pruebas emplean datos ficticios. Los datos de producción no deben copiarse a entornos de desarrollo para reproducir fallos rutinarios.

Relaciones: [[Matriz de permisos]], [[Organizaciones y membresias]] y [[Operacion y continuidad]].
