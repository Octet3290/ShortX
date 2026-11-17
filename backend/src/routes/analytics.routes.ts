import { Router } from 'express';
import { getDashboard, getLinkAnalytics } from '../controllers/analytics.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// All analytics routes require authentication
router.use(requireAuth);

router.get('/dashboard', getDashboard);
router.get('/links/:id', getLinkAnalytics);

export default router;
