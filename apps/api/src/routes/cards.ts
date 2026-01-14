// apps/api/src/routes/cards.ts

import { Router } from 'express';
import { CardController } from '../controllers/CardController';
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

export default router;
