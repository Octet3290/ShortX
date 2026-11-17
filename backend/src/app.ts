import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import healthRoutes from './routes/health.routes';
import authRoutes from './routes/auth.routes';
import linkRoutes from './routes/link.routes';
import analyticsRoutes from './routes/analytics.routes';
import redirectRoutes from './routes/redirect.routes';
import { globalApiLimiter, strictSecurityLimiter } from './middleware/rateLimit.middleware';
import { startAnalyticsWorker } from './jobs/analytics.worker';

// Start the asynchronous background worker
startAnalyticsWorker();

const app = express();

// Security HTTP headers
app.use(helmet());

// Cross-Origin Resource Sharing
app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
  })
);

// Body parser
app.use(express.json());

// Apply global rate limiting to all /api routes
app.use('/api', globalApiLimiter);

// Dedicated security rate-limit testing route
app.get('/api/security/test-limit', strictSecurityLimiter, (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', message: 'Request within limit' });
});

// API Routes
app.use('/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/links', linkRoutes);
app.use('/api/analytics', analyticsRoutes);

// Root fallback
app.get('/', (req: Request, res: Response) => {
  res.status(200).json({
    message: 'Welcome to ShortX API',
    docs: '/api/docs',
    health: '/health',
  });
});

// Wildcard short URL redirect service
app.use('/', redirectRoutes);

// 404 Handler for undefined routes
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'NotFound',
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

// Centralized Global Error Handler
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({
    error: 'InternalServerError',
    message: env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message,
  });
});

export default app;
