---
title: "Seguridad y modelo de amenazas"
tipo: "seguridad"
estado: "base inicial"
---

# Seguridad y modelo de amenazas

## Activos prioritarios

| Activo | Daño principal |
| :--- | :--- |
| Identidad y sesión | Suplantación y escalamiento |
| Datos de organización | Exposición cruzada y pérdida de confianza |
| Decisiones y auditoría | Manipulación de gobierno y negación de responsabilidad |
| Evidencia y archivos | Fuga, malware o pérdida |
| Disponibilidad del flujo | Interrupción de operaciones institucionales |
| Secretos e integraciones | Movimiento lateral y abuso externo |

## Amenazas y controles

| Amenaza | Escenario | Controles preventivos | Detección y respuesta |
| :--- | :--- | :--- | :--- |
| Suplantación | Robo o fijación de sesión | OIDC, cookie segura, rotación, MFA del proveedor, reautenticación | Sesiones visibles, revocación, alertas de acceso anómalo |
| Alteración | Cambio directo de estado o evaluación histórica | Máquina de estados, versión, firmas lógicas, permisos y restricciones | Auditoría correlacionada y alertas de transición imposible |
| Repudio | Actor niega una decisión | Auditoría append only, hora confiable y motivo obligatorio | Exportación verificable y revisión de integridad |
| Divulgación | IDOR entre organizaciones o URL de archivo reutilizada | Scope obligatorio, claves consistentes, URL breve, CSP y minimización | Pruebas canario, registros de denegación y respuesta a incidente |
| Denegación | Abuso de login, búsqueda, archivos o WebSocket | Cuotas por identidad y red, tamaño máximo, backpressure y proxy | Métricas de saturación, bloqueo gradual y runbook |
| Elevación | Rol manipulado o soporte permanente | Política central, privilegio mínimo, JIT y separación de funciones | Revisión de roles y alerta sobre elevaciones |
| Cadena de suministro | Paquete, imagen o acción comprometida | Lockfile, procedencia, SBOM, firmas, escaneo y permisos mínimos de CI | Alertas, bloqueo, reconstrucción y rotación |
| Inyección | SQL, HTML, plantillas o contenido de IA malicioso | Parámetros, sanitización contextual, CSP, validación y aislamiento | WAF, pruebas y telemetría sin reflejar secretos |

## Ciclo seguro

| Momento | Control obligatorio |
| :--- | :--- |
| Diseño | Clasificación de datos, diagrama de flujo, STRIDE y abuso por historia |
| Desarrollo | Revisión, tipos estrictos, análisis estático, secretos y dependencias |
| Integración | Pruebas de autorización, contrato, migración y configuración |
| Preproducción | DAST dirigido, revisión ASVS, backup, restore y carga |
| Producción | Parcheo, monitoreo, respuesta, rotación y ejercicios |

## Controles web

Se aplica Content Security Policy con nonce o hashes donde corresponda, protección CSRF compatible con el patrón de sesión, validación de origen para mutaciones y WebSocket, encabezados de seguridad, límites de cuerpo, tipos MIME estrictos y salida codificada. Next.js se ubica detrás de un proxy que filtra solicitudes malformadas, impone límites y controla exposición.

## Archivos e IA

Los archivos se cargan mediante canal autorizado, se ponen en cuarentena, se validan por contenido y se escanean antes de publicarse. Los nombres no definen rutas. La IA, cuando se habilite, usa conjuntos permitidos, registra modelo y fuentes, protege contra instrucciones incrustadas, limita herramientas y exige confirmación humana para acciones.

## Respuesta a incidentes

Se definen severidad, guardia, responsables, canales, preservación de evidencia, comunicación, notificación legal y criterios de cierre. La prioridad inmediata es contener daño, luego restaurar con seguridad y finalmente aprender. Nunca se alteran registros para ocultar un incidente.

## Relaciones

El acceso se desarrolla en [[Identidad, autorizacion y sesiones]], la operación en [[Observabilidad, continuidad y soporte]] y las pruebas abusivas en [[Catalogo de casos de prueba]].
