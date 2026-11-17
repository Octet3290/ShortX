import { Router } from 'express';
import { register, login, getMe } from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { authLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

// Public routes (Rate-limited against brute-force)
router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);

// Protected routes (Requires Bearer JWT token)
router.get('/me', requireAuth, getMe);

export default router;
