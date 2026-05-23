// apps/api/src/routes/events.ts

import { Router } from 'express';
import { calendarEventController } from '../controllers/CalendarEventController';
import { authenticateJWT } from '../middleware/auth';

const router = Router();

router.use(authenticateJWT);

router.get('/me',  (req, res) => calendarEventController.getMyEvents(req, res));
router.post('/',   (req, res) => calendarEventController.create(req, res));
router.get('/:id', (req, res) => calendarEventController.getById(req, res));
router.patch('/:id', (req, res) => calendarEventController.update(req, res));
router.delete('/:id', (req, res) => calendarEventController.delete(req, res));

export default router;
