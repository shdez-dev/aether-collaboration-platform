# Revisión legal del piloto · 20 de octubre de 2026

Alcance actualizado el 21 de octubre de 2026: primera etapa en Chile y Argentina.

## Alcance decidido

- Operador: Juan Sebastian Hernandez Rincon, persona natural establecida en Chile.
- Contacto público: sebastian@shernandez.dev.
- Piloto gratuito por invitación previsto inicialmente para Chile y Argentina. Antes de invitar en Argentina debe aclararse la inscripción del responsable ante la AAIP.
- Colombia y México quedan para una etapa posterior. El producto no verifica automáticamente el país de residencia.
- Los textos en `/legal/terms`, `/legal/privacy` y `/legal/aup` siguen identificados como borradores; la fecha de revisión no es una fecha de entrada en vigor.

## Información del producto contrastada con el código

- Las cuentas nuevas requieren una invitación válida. El acceso a proyectos y documentos se verifica por permisos.
- El registro y el inicio de sesión solicitan dos confirmaciones de lectura separadas, pero `terms_read_at` y `privacy_read_at` se sobrescriben en cada inicio de sesión. No existe un historial inmutable que identifique la versión de cada documento aceptada por cada persona.
- El chat directo tiene caducidad de 30 días y un trabajo de eliminación. No hay un plazo único acreditado para documentos, archivos, notificaciones, actividad, registros y respaldos.
- El código permite correo con Brevo, archivos en Cloudflare R2 o almacenamiento local, planificación opcional con Groq e integración opcional con GitHub. La base de datos usa PostgreSQL y el servicio usa Redis. Los países y proveedores efectivos del despliegue no se deducen de esa configuración.
- No hay autoservicio integral confirmado de cierre de cuenta ni de exportación de todos los datos.

## Pendiente antes de convertir los textos en condiciones definitivas

1. Identificar el despliegue real: proveedor y país de alojamiento de la aplicación, PostgreSQL, Redis, archivos y respaldos; contratos y transferencias de datos de cada proveedor.
2. Definir plazos y procedimiento de eliminación para cada categoría de datos, incluidos respaldos.
3. Definir base jurídica o autorización requerida para cada finalidad y cada país de destino; separar funciones opcionales de la lectura de la política.
4. Implementar una constancia histórica de versión y fecha de los documentos aceptados y un procedimiento de solicitudes de titulares, verificación de identidad y respuesta.
5. Revisar los datos de contacto exigibles para Argentina. La autoridad argentina indica que los responsables no establecidos en Argentina que traten datos de argentinos deben consultar la inscripción correspondiente. Los requisitos de Colombia y México se revisarán antes de ampliar el piloto.
6. Definir regla de edad y comprobarla si se desea imponer; documentar respaldos, recuperación, incidentes y revisión de medidas por abuso.
7. Confirmar con asesoría jurídica la aplicabilidad territorial y los pasos exigibles para Argentina, además de la reforma chilena que comienza a regir el 1 de diciembre de 2026. No extender las invitaciones a Colombia o México sin revisar antes sus requisitos.

## Fuentes oficiales consultadas

- Chile: https://www.bcn.cl/leychile/Navegar?idNorma=1209272&idVersion=2026-12-01
- Argentina: https://www.argentina.gob.ar/aaip/datospersonales/tramites
- Colombia: https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=49981
- México: https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPDPPP.pdf
