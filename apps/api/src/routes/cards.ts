// apps/api/src/routes/cards.ts

import { Router } from 'express';
import { CardController } from '../controllers/CardController';
import { authenticateJWT } from '../middleware/auth';

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
router.get('/lists/:listId/cards', authenticateJWT, CardController.getListCards);

// Crear card en una lista
router.post('/lists/:listId/cards', authenticateJWT, CardController.createCard);

// Obtener card por ID
router.get('/cards/:id', authenticateJWT, CardController.getCard);

// Actualizar card
router.put('/cards/:id', authenticateJWT, CardController.updateCard);

// Mover card (cambiar de lista o reordenar)
router.put('/cards/:id/move', authenticateJWT, CardController.moveCard);

// Eliminar card
router.delete('/cards/:id', authenticateJWT, CardController.deleteCard);

// ==================== MIEMBROS DE CARD ====================

// Asignar miembro a card
router.post('/cards/:id/members', authenticateJWT, CardController.assignMember);

// Desasignar miembro de card
router.delete('/cards/:id/members/:userId', authenticateJWT, CardController.unassignMember);

// ==================== LABELS DE CARD ====================

// Agregar label a card
router.post('/cards/:id/labels', authenticateJWT, CardController.addLabel);

// Remover label de card
router.delete('/cards/:id/labels/:labelId', authenticateJWT, CardController.removeLabel);

export default router;
