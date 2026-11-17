import { Router } from 'express';
import {
  createLink,
  getUserLinks,
  getLinkById,
  updateLink,
  deleteLink,
} from '../controllers/link.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { linkCreationLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

// All link routes require authentication
router.use(requireAuth);

router.post('/', linkCreationLimiter, createLink);
router.get('/', getUserLinks);
router.get('/:id', getLinkById);
router.patch('/:id', updateLink);
router.delete('/:id', deleteLink);

export default router;
