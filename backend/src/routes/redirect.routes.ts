import { Router } from 'express';
import { handleRedirect } from '../controllers/redirect.controller';

const router = Router();

// Wildcard short URL redirect
router.get('/:shortCode', handleRedirect);

export default router;
