// apps/api/src/routes/cards.ts

import { Router } from 'express';
import { CardController } from '../controllers/CardController';
import { ChecklistController } from '../controllers/ChecklistController';
import { DependencyController } from '../controllers/DependencyController';
import { authenticateJWT } from '../middleware/auth';
import { checkWorkspaceMembership } from '../middleware/workspace';

const router = Router();

/**
 * ==================== RUTAS DE CARDS ====================
 *
 * Todas las rutas requieren autenticación JWT
 * El orden de las rutas es importante para evitar conflictos de patrón
 */

/**
 * IMPORTANTE: Esta ruta debe ir ANTES de POST /lists/:listId/cards
 * para evitar que Express confunda :listId con "cards"
 */
// Obtener todas las cards de una lista
// Middleware: checkWorkspaceMembership (resuelve workspace desde listId)
// Permite: Todos los roles
router.get(
  '/lists/:listId/cards',
  authenticateJWT,
  checkWorkspaceMembership,
  CardController.getListCards
);

// Crear card en una lista
// Middleware: checkWorkspaceMembership (resuelve workspace desde listId)
// Controller: Valida rol ADMIN/OWNER
router.post(
  '/lists/:listId/cards',
  authenticateJWT,
  checkWorkspaceMembership,
  CardController.createCard
);

// Obtener card por ID
// Middleware: checkWorkspaceMembership (resuelve workspace desde cardId)
// Permite: Todos los roles
router.get('/cards/:id', authenticateJWT, checkWorkspaceMembership, CardController.getCard);

// Actualizar card
// Middleware: checkWorkspaceMembership (resuelve workspace desde cardId)
// Controller: Valida rol ADMIN/OWNER
router.put('/cards/:id', authenticateJWT, checkWorkspaceMembership, CardController.updateCard);

// Mover card (cambiar de lista o reordenar)
// Middleware: checkWorkspaceMembership (resuelve workspace desde cardId)
// Controller: Valida rol ADMIN/OWNER
router.put('/cards/:id/move', authenticateJWT, checkWorkspaceMembership, CardController.moveCard);

// Eliminar card
// Middleware: checkWorkspaceMembership (resuelve workspace desde cardId)
// Controller: Valida rol ADMIN/OWNER
router.delete('/cards/:id', authenticateJWT, checkWorkspaceMembership, CardController.deleteCard);

// ==================== MIEMBROS DE CARD ====================

// Asignar miembro a card
// Middleware: checkWorkspaceMembership (resuelve workspace desde cardId)
// Controller: Valida rol ADMIN/OWNER
router.post(
  '/cards/:id/members',
  authenticateJWT,
  checkWorkspaceMembership,
  CardController.assignMember
);

// Desasignar miembro de card
// Middleware: checkWorkspaceMembership (resuelve workspace desde cardId)
// Controller: Valida rol ADMIN/OWNER
router.delete(
  '/cards/:id/members/:userId',
  authenticateJWT,
  checkWorkspaceMembership,
  CardController.unassignMember
);

// ==================== LABELS DE CARD ====================

// Agregar label a card
// Middleware: checkWorkspaceMembership (resuelve workspace desde cardId)
// Permite: Todos los roles (labels son accesibles para todos)
router.post(
  '/cards/:id/labels',
  authenticateJWT,
  checkWorkspaceMembership,
  CardController.addLabel
);

// Remover label de card
// Middleware: checkWorkspaceMembership (resuelve workspace desde cardId)
// Permite: Todos los roles (labels son accesibles para todos)
router.delete(
  '/cards/:id/labels/:labelId',
  authenticateJWT,
  checkWorkspaceMembership,
  CardController.removeLabel
);

// ==================== CHECKLIST DE CARD ====================

// Obtener ítems del checklist
router.get(
  '/cards/:id/checklist',
  authenticateJWT,
  checkWorkspaceMembership,
  ChecklistController.getItems
);

// Crear ítem en el checklist (ADMIN, OWNER, MEMBER)
router.post(
  '/cards/:id/checklist',
  authenticateJWT,
  checkWorkspaceMembership,
  ChecklistController.createItem
);

// Actualizar ítem del checklist (ADMIN, OWNER, MEMBER)
router.put(
  '/cards/:id/checklist/:itemId',
  authenticateJWT,
  checkWorkspaceMembership,
  ChecklistController.updateItem
);

// Eliminar ítem del checklist (ADMIN, OWNER)
router.delete(
  '/cards/:id/checklist/:itemId',
  authenticateJWT,
  checkWorkspaceMembership,
  ChecklistController.deleteItem
);

// ==================== DEPENDENCIAS ENTRE CARDS ====================

// Buscar cards del mismo board (para picker — va ANTES del :id genérico)
router.get(
  '/cards/:id/dependencies/search',
  authenticateJWT,
  checkWorkspaceMembership,
  DependencyController.searchCards
);

// Obtener dependencias de una card
router.get(
  '/cards/:id/dependencies',
  authenticateJWT,
  checkWorkspaceMembership,
  DependencyController.getDependencies
);

// Agregar dependencia (esta card es bloqueada por blockingCardId)
router.post(
  '/cards/:id/dependencies',
  authenticateJWT,
  checkWorkspaceMembership,
  DependencyController.addDependency
);

// Eliminar dependencia
router.delete(
  '/cards/:id/dependencies/:depId',
  authenticateJWT,
  checkWorkspaceMembership,
  DependencyController.removeDependency
);

export default router;
