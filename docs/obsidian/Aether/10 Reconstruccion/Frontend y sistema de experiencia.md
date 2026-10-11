---
title: "Frontend y sistema de experiencia"
tipo: "experiencia y frontend"
estado: "propuesto"
---

# Frontend y sistema de experiencia

## Enfoque

Next.js App Router organiza la experiencia por recorridos de producto, no por tablas. Los componentes de servidor son la opción inicial para lectura y composición. Los componentes de cliente se reservan para formularios interactivos, editores, tiempo real y estado local genuino. Las Route Handlers se usan como borde web o integración específica, mientras la lógica de negocio permanece en el servidor de aplicación.

## Arquitectura de interfaz

| Capa | Responsabilidad |
| :--- | :--- |
| Ruta | Carga inicial, metadatos, layout y límites de error |
| Feature | Flujo de usuario, formularios, permisos visibles y estados |
| UI | Componentes accesibles y tokens sin conocimiento de negocio |
| Cliente API | Tipos generados, correlación, errores y cancelación |
| Estado | URL para navegación, servidor para verdad compartida, local para interacción efímera |

No se duplica información del servidor en almacenes globales sin necesidad. Los permisos visuales provienen de capacidades entregadas por el servidor y toda acción se revalida. Los formularios preservan datos ante fallos, distinguen validación de conflicto y ofrecen recuperación.

## Sistema de diseño

El sistema define tokens de color, tipografía, espaciado, elevación, movimiento y foco. Cada componente documenta anatomía, estados, teclado, nombre accesible, contenido, densidad y errores. Se priorizan componentes sin estilos o primitivas accesibles antes de construir interacción compleja desde cero.

| Estado obligatorio | Tratamiento |
| :--- | :--- |
| Cargando | Esqueleto estable o progreso con propósito |
| Vacío | Explica por qué no hay datos y cuál es la acción posible |
| Sin permiso | No revela contenido y explica el siguiente paso seguro |
| Error recuperable | Conserva entrada y permite reintento controlado |
| Conflicto | Muestra que cambió y permite recargar o conciliar |
| Degradado | Indica qué capacidad está temporalmente limitada |

## Accesibilidad

El flujo completo funciona con teclado, zoom, contraste y lector de pantalla. El foco se mueve de forma predecible después de navegación, diálogo y error. Tablas complejas tienen encabezados y alternativa responsive. Arrastrar siempre dispone de alternativa por controles. Las animaciones respetan preferencias de movimiento reducido.

## Seguridad web

Se adopta CSP estricta, sin HTML arbitrario. La serialización servidor a cliente excluye secretos y datos no necesarios. Las mutaciones incorporan protección CSRF, origen validado y mensajes que no filtran existencia. Las cargas de archivo no confían en extensión ni MIME declarados.

## Relaciones

Los flujos nacen de [[Historias de usuario greenfield]], los contratos de [[API, eventos y trabajos asincronos]] y las pruebas de [[Estrategia de pruebas greenfield]].
